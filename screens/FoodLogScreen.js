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
      const user = auth().currentUser;
      
      if (!user) return;
      
      const userDoc = await firestore()
        .collection('users')
        .doc(user.uid)
        .get();
        
      if (userDoc.exists) {
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
      const user = auth().currentUser;
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Create food log entry
      const foodLog = {
        items: selectedFoods,
        notes: notes.trim(),
        timestamp: firestore.FieldValue.serverTimestamp()
      };
      
      // Add to user's food logs array
      await firestore()
        .collection('users')
        .doc(user.uid)
        .update({
          food_logs: firestore.FieldValue.arrayUnion(foodLog)
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
                selectedColor="#6200ee"
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
              <ActivityIndicator size="small" color="#6200ee" />
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
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionDescription: {
    color: '#666',
    marginBottom: 16,
  },
  foodChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    margin: 4,
  },
  divider: {
    marginVertical: 16,
  },
  customFoodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  customFoodInput: {
    flex: 1,
    marginRight: 8,
  },
  addButton: {
    marginLeft: 8,
  },
  selectedFoods: {
    marginTop: 16,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  selectedChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  selectedChip: {
    margin: 4,
    backgroundColor: '#e1bee7',
  },
  notesInput: {
    marginTop: 8,
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 4,
  },
  saveButtonContent: {
    paddingVertical: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
  },
  logItem: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    padding: 20,
  },
});