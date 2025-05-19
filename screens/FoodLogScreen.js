import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  Alert,
  TouchableOpacity
} from 'react-native';
import { 
  TextInput, 
  Button, 
  Chip, 
  Divider, 
  List, 
  ActivityIndicator 
} from 'react-native-paper';
import { auth, firestore } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, updateDoc, getDoc, query, orderBy, arrayUnion, serverTimestamp, addDoc } from 'firebase/firestore';

const COMMON_FOODS = [
  'Milk', 'Eggs', 'Bread', 'Pasta', 'Rice', 
  'Chicken', 'Beef', 'Fish', 'Peanuts', 'Tree nuts',
  'Soy', 'Wheat', 'Corn', 'Shellfish', 'Fruits', 'Vegetables'
];

export default function FoodLogScreen() {
  const [selectedFoods, setSelectedFoods] = useState([]);
  const [customFood, setCustomFood] = useState('');
  const [notes, setNotes] = useState('');
  const [foodLogs, setFoodLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingLogs, setFetchingLogs] = useState(true);
  
  useEffect(() => {
    fetchFoodLogs();
  }, []);
  
  const fetchFoodLogs = async () => {
    try {
      setFetchingLogs(true);
      const currentUser = auth.currentUser;
      
      if (!currentUser) return;
      
      const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
        
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Get food logs and sort by timestamp (newest first)
        const logs = userData.food_logs || [];
        
        // Convert Firestore timestamps to Date objects for sorting
        const logsWithDates = logs.map(log => ({
          ...log,
          date: log.timestamp ? log.timestamp.toDate() : new Date()
        }));
        
        // Sort by date (newest first)
        logsWithDates.sort((a, b) => b.date - a.date);
        
        setFoodLogs(logsWithDates);
      }
    } catch (error) {
      console.error('Error fetching food logs:', error);
      Alert.alert('Error', 'Failed to load your food logs');
    } finally {
      setFetchingLogs(false);
    }
  };
  
  const toggleFood = (food) => {
    if (selectedFoods.includes(food)) {
      setSelectedFoods(selectedFoods.filter(item => item !== food));
    } else {
      setSelectedFoods([...selectedFoods, food]);
    }
  };
  
  const addCustomFood = () => {
    if (!customFood.trim()) return;
    
    const formattedFood = customFood.trim();
    if (!selectedFoods.includes(formattedFood)) {
      setSelectedFoods([...selectedFoods, formattedFood]);
      setCustomFood('');
    } else {
      Alert.alert('Duplicate', 'This food is already in your list');
    }
  };
  
  const saveFoodLog = async () => {
    if (selectedFoods.length === 0) {
      Alert.alert('Error', 'Please select at least one food item');
      return;
    }
    
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('User not found');
      }
      
      // Create food log entry
      const foodLog = {
        items: selectedFoods,
        notes: notes.trim(),
        timestamp: new Date()
      };
      
      // Add to user's food logs array
      const userRef = doc(firestore, 'users', currentUser.uid);
      await updateDoc(userRef, {
        food_logs: arrayUnion(foodLog)
      });
      
      // Also add to separate collection for easier querying
      await addDoc(collection(firestore, 'allergy_reports'), {
        userId: currentUser.uid,
        ...foodLog
      });

      // Clear form
      setSelectedFoods([]);
      setNotes('');
      
      // Refresh logs
      fetchFoodLogs();
      
      Alert.alert('Success', 'Food log saved successfully');
    } catch (error) {
      console.error('Error saving food log:', error);
      Alert.alert('Error', 'Failed to save your food log');
    } finally {
      setLoading(false);
    }
  };
  
  const formatDate = (date) => {
    if (!date) return 'Unknown date';
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Log Your Food</Text>
        <Text style={styles.subtitle}>
          Keep track of what you eat to help identify potential triggers
        </Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Foods</Text>
          <Text style={styles.sectionDescription}>
            Tap on all foods you've consumed recently
          </Text>
          
          <View style={styles.foodChips}>
            {COMMON_FOODS.map((food) => (
              <Chip
                key={food}
                selected={selectedFoods.includes(food)}
                onPress={() => toggleFood(food)}
                style={styles.chip}
                selectedColor="#00CED1"
                mode={selectedFoods.includes(food) ? 'flat' : 'outlined'}
              >
                {food}
              </Chip>
            ))}
          </View>
        </View>
        
        <Divider style={styles.divider} />
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Custom Food</Text>
          
          <View style={styles.customFoodContainer}>
            <TextInput
              mode="outlined"
              label="Food item"
              value={customFood}
              onChangeText={setCustomFood}
              style={styles.customFoodInput}
            />
            <Button 
              mode="contained" 
              onPress={addCustomFood}
              style={styles.addButton}
            >
              Add
            </Button>
          </View>
          
          {selectedFoods.length > 0 && (
            <View style={styles.selectedFoods}>
              <Text style={styles.selectedTitle}>Your Selected Foods:</Text>
              <View style={styles.selectedChips}>
                {selectedFoods.map((food) => (
                  <Chip
                    key={food}
                    onClose={() => toggleFood(food)}
                    style={styles.selectedChip}
                  >
                    {food}
                  </Chip>
                ))}
              </View>
            </View>
          )}
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            mode="outlined"
            label="Add notes about this meal (optional)"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            style={styles.notesInput}
          />
        </View>
        
        <Button
          mode="contained"
          onPress={saveFoodLog}
          loading={loading}
          disabled={loading || selectedFoods.length === 0}
          style={styles.saveButton}
          contentStyle={styles.saveButtonContent}
        >
          Save Food Log
        </Button>
        
        <Divider style={styles.divider} />
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Food Logs</Text>
          
          {fetchingLogs ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#00CED1" />
              <Text style={styles.loadingText}>Loading food logs...</Text>
            </View>
          ) : foodLogs.length > 0 ? (
            foodLogs.map((log, index) => (
              <List.Item
                key={index}
                title={formatDate(log.date)}
                description={log.items.join(', ')}
                left={props => <List.Icon {...props} icon="food" />}
                style={styles.logItem}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>No food logs yet</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0FFFF', // Light Cyan
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#008B8B', // Dark Cyan
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: 18,
    color: '#20B2AA', // Light Sea Green
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#008B8B', // Dark Cyan
  },
  sectionDescription: {
    color: '#20B2AA', // Light Sea Green
    marginBottom: 16,
    fontSize: 16,
  },
  foodChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    margin: 4,
    backgroundColor: '#F0FFFF', // Azure
    borderColor: '#00CED1', // Deep Turquoise
  },
  divider: {
    marginVertical: 20,
    backgroundColor: '#00CED1', // Deep Turquoise
    height: 1,
  },
  customFoodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  customFoodInput: {
    flex: 1,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
  },
  addButton: {
    marginLeft: 8,
    backgroundColor: '#00CED1', // Deep Turquoise
  },
  selectedFoods: {
    marginTop: 20,
    backgroundColor: '#F0FFFF', // Azure
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#008B8B', // Dark Cyan
  },
  selectedChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  selectedChip: {
    margin: 4,
    backgroundColor: '#00CED1', // Deep Turquoise
  },
  notesInput: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
  },
  saveButton: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#00CED1', // Deep Turquoise
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  saveButtonContent: {
    paddingVertical: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#008B8B', // Dark Cyan
    fontSize: 16,
  },
  logItem: {
    backgroundColor: '#F0FFFF', // Azure
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#20B2AA', // Light Sea Green
    padding: 24,
    fontSize: 16,
  },
});