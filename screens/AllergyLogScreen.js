import React, { useState } from 'react';
import { 
  StyleSheet, View, Text, ScrollView, Alert 
} from 'react-native';
import { 
  TextInput, Button, Chip, Divider, 
} from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { auth, firestore } from '../firebase';
import { doc, updateDoc, arrayUnion, collection, addDoc } from 'firebase/firestore';

// Common allergy symptoms
const COMMON_SYMPTOMS = [
  'Itching', 'Rash', 'Hives', 'Swelling', 'Sneezing',
  'Runny nose', 'Watery eyes', 'Coughing', 'Wheezing',
  'Shortness of breath', 'Nausea', 'Stomach pain', 'Diarrhea',
  'Headache', 'Dizziness', 'Throat tightness'
];

export default function AllergyLogScreen({ navigation }) {
  const [severity, setSeverity] = useState(5);
  const [symptoms, setSymptoms] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  
  const toggleSymptom = (symptom) => {
    if (symptoms.includes(symptom)) {
      setSymptoms(symptoms.filter(item => item !== symptom));
    } else {
      setSymptoms([...symptoms, symptom]);
    }
  };
  
  const reportAllergy = async () => {
    if (symptoms.length === 0) {
      Alert.alert('Error', 'Please select at least one symptom');
      return;
    }
    
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('User not found');
      }
      
      // Create allergy report with current timestamp
      const report = {
        severity: severity,
        symptoms: symptoms,
        notes: notes.trim(),
        timestamp: new Date()
      };
      
      // Add to user's severity history
      const userRef = doc(firestore, 'users', currentUser.uid);
      await updateDoc(userRef, {
        severity_history: arrayUnion(report)
      });
      
      // Also add to separate collection for easier querying
      await addDoc(collection(firestore, 'allergy_reports'), {
        userId: currentUser.uid,
        ...report
      });
      
      Alert.alert(
        'Report Submitted',
        'Your allergy reaction has been recorded. We\'ll use this to improve your predictions.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error reporting allergy:', error);
      Alert.alert('Error', 'Failed to save your allergy report');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Report Allergy Reaction</Text>
        <Text style={styles.subtitle}>
          Log your allergy symptoms to help improve predictions
        </Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reaction Severity</Text>
          <Text style={styles.severityValue}>{severity}/10</Text>
          <Slider
            value={severity}
            onValueChange={setSeverity}
            minimumValue={1}
            maximumValue={10}
            step={1}
            style={styles.slider}
            minimumTrackTintColor="#00CED1"
            thumbTintColor="#00CED1"
          />
          <View style={styles.severityLabels}>
            <Text style={styles.severityLabel}>Mild</Text>
            <Text style={styles.severityLabel}>Moderate</Text>
            <Text style={styles.severityLabel}>Severe</Text>
          </View>
        </View>
        
        <Divider style={styles.divider} />
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Symptoms</Text>
          <Text style={styles.sectionDescription}>
            Select all symptoms you experienced
          </Text>
          
          <View style={styles.symptoms}>
            {COMMON_SYMPTOMS.map((symptom) => (
              <Chip
                key={symptom}
                selected={symptoms.includes(symptom)}
                onPress={() => toggleSymptom(symptom)}
                style={styles.chip}
                selectedColor="#00CED1"
                mode={symptoms.includes(symptom) ? 'flat' : 'outlined'}
              >
                {symptom}
              </Chip>
            ))}
          </View>
          
          {symptoms.length > 0 && (
            <View style={styles.selectedSymptoms}>
              <Text style={styles.selectedTitle}>Selected Symptoms:</Text>
              <Text style={styles.symptomsText}>
                {symptoms.join(', ')}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes</Text>
          <TextInput
            mode="outlined"
            label="Any additional details about this reaction"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            style={styles.notesInput}
          />
        </View>
        
        <Button
          mode="contained"
          onPress={reportAllergy}
          loading={loading}
          disabled={loading || symptoms.length === 0}
          style={styles.submitButton}
          contentStyle={styles.submitButtonContent}
        >
          Submit Report
        </Button>
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
  severityValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00CED1',
    textAlign: 'center',
    marginVertical: 8,
  },
  slider: {
    height: 40,
  },
  severityLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  severityLabel: {
    color: '#666',
    fontSize: 12,
  },
  divider: {
    marginVertical: 16,
  },
  symptoms: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    margin: 4,
  },
  selectedSymptoms: {
    marginTop: 16,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  symptomsText: {
    color: '#333',
  },
  notesInput: {
    marginTop: 8,
  },
  submitButton: {
    marginTop: 16,
    borderRadius: 4,
    backgroundColor: '#ff6b6b',
  },
  submitButtonContent: {
    paddingVertical: 8,
  },
});