import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView,
  Alert
} from 'react-native';
import { Button, Chip, TextInput, Divider } from 'react-native-paper';
import { auth, firestore } from '../firebase';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';

// Common allergens for quick selection
const COMMON_ALLERGENS = [
  'Peanuts', 'Tree nuts', 'Milk', 'Eggs', 'Wheat', 
  'Soy', 'Fish', 'Shellfish', 'Sesame'
];

export default function SetupScreen() {
  const [selectedAllergens, setSelectedAllergens] = useState([]);
  const [customAllergen, setCustomAllergen] = useState('');
  const [loading, setLoading] = useState(false);
  
  const toggleAllergen = (allergen) => {
    if (selectedAllergens.includes(allergen)) {
      setSelectedAllergens(selectedAllergens.filter(item => item !== allergen));
    } else {
      setSelectedAllergens([...selectedAllergens, allergen]);
    }
  };
  
  const addCustomAllergen = () => {
    if (!customAllergen.trim()) return;
    
    const formattedAllergen = customAllergen.trim();
    if (!selectedAllergens.includes(formattedAllergen)) {
      setSelectedAllergens([...selectedAllergens, formattedAllergen]);
      setCustomAllergen('');
    } else {
      Alert.alert('Duplicate', 'This allergen is already in your list');
    }
  };
  
  const completeSetup = async () => {
    console.log('Starting setup completion...');
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        console.log('No user found in auth');
        throw new Error('User not found');
      }
      
      console.log('Updating user document for:', currentUser.uid);
      const userRef = doc(firestore, 'users', currentUser.uid);
      
      // First update the document
      await updateDoc(userRef, {
        allergens: selectedAllergens,
        setupComplete: true,
        updated_at: serverTimestamp()
      });
      
      console.log('Setup completed successfully');
      
      // Force a small delay to ensure the update is processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Try to force a re-read of the document
      const updatedDoc = await getDoc(userRef);
      if (updatedDoc.exists()) {
        const data = updatedDoc.data();
        console.log('Updated document data:', data);
        if (data.setupComplete) {
          console.log('Setup complete flag is true in document');
        } else {
          console.log('Setup complete flag is false in document');
        }
      }
      
    } catch (error) {
      console.error('Setup error:', error);
      Alert.alert(
        'Error',
        'Failed to save your profile. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Set Up Your Profile</Text>
        <Text style={styles.subtitle}>
          Tell us about your allergies so we can provide personalized predictions
        </Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Your Allergens</Text>
          <Text style={styles.sectionDescription}>
            Tap on all allergens that affect you
          </Text>
          
          <View style={styles.allergenChips}>
            {COMMON_ALLERGENS.map((allergen) => (
              <Chip
                key={allergen}
                selected={selectedAllergens.includes(allergen)}
                onPress={() => toggleAllergen(allergen)}
                style={styles.chip}
                selectedColor="#48D1CC"
                mode={selectedAllergens.includes(allergen) ? 'flat' : 'outlined'}
              >
                {allergen}
              </Chip>
            ))}
          </View>
        </View>
        
        <Divider style={styles.divider} />
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Custom Allergen</Text>
          <Text style={styles.sectionDescription}>
            Don't see your allergen? Add it here
          </Text>
          
          <View style={styles.customAllergenContainer}>
            <TextInput
              mode="outlined"
              label="Custom allergen"
              value={customAllergen}
              onChangeText={setCustomAllergen}
              style={styles.customAllergenInput}
            />
            <Button 
              mode="contained" 
              onPress={addCustomAllergen}
              style={styles.addButton}
            >
              Add
            </Button>
          </View>
          
          {selectedAllergens.length > 0 && (
            <View style={styles.selectedAllergens}>
              <Text style={styles.selectedTitle}>Your Selected Allergens:</Text>
              <View style={styles.selectedChips}>
                {selectedAllergens.map((allergen) => (
                  <Chip
                    key={allergen}
                    onClose={() => toggleAllergen(allergen)}
                    style={styles.selectedChip}
                  >
                    {allergen}
                  </Chip>
                ))}
              </View>
            </View>
          )}
        </View>
        
        <Button
          mode="contained"
          onPress={completeSetup}
          loading={loading}
          disabled={loading || selectedAllergens.length === 0}
          style={styles.completeButton}
          contentStyle={styles.completeButtonContent}
        >
          Complete Setup
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#AFEEEE', // PaleTurquoise background
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
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
  allergenChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    margin: 4,
  },
  divider: {
    marginVertical: 16,
  },
  customAllergenContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  customAllergenInput: {
    flex: 1,
    marginRight: 8,
  },
  addButton: {
    marginLeft: 8,
  },
  selectedAllergens: {
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
    backgroundColor: '#E0FFFF', // LightCyan
  },
  completeButton: {
    marginTop: 24,
    borderRadius: 4,
    backgroundColor: '#48D1CC', // MediumTurquoise
  },
  completeButtonContent: {
    paddingVertical: 8,
  },
});