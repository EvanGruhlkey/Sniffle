import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, List, Checkbox } from 'react-native-paper';
import { auth, firestore } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

export default function AllergenSetupScreen({ navigation }) {
  const [selectedAllergens, setSelectedAllergens] = useState([]);
  const [loading, setLoading] = useState(false);

  const commonAllergens = [
    'Peanuts',
    'Tree Nuts',
    'Milk',
    'Eggs',
    'Soy',
    'Wheat',
    'Fish',
    'Shellfish',
    'Sesame',
    'Mustard',
    'Celery',
    'Lupin',
    'Sulfites',
    'Gluten'
  ];

  const handleAllergenToggle = (allergen) => {
    setSelectedAllergens(prev => {
      if (prev.includes(allergen)) {
        return prev.filter(a => a !== allergen);
      } else {
        return [...prev, allergen];
      }
    });
  };

  const handleSave = async () => {
    if (selectedAllergens.length === 0) {
      Alert.alert('Warning', 'Please select at least one allergen');
      return;
    }

    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) throw new Error('No user logged in');

      await updateDoc(doc(firestore, 'users', user.uid), {
        allergens: selectedAllergens,
        setupComplete: true
      });

      Alert.alert(
        'Success',
        'Allergen preferences saved successfully',
        [{ text: 'OK', onPress: () => navigation.navigate('MainTabs') }]
      );
    } catch (error) {
      console.error('Error saving allergens:', error);
      Alert.alert('Error', 'Failed to save allergen preferences');
    } finally {
      setLoading(false);
    }
  };

  // ... rest of the component code ...
} 