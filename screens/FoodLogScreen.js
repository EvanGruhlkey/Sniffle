import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  Alert
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
import { collection, doc, setDoc, getDoc, arrayUnion, addDoc, serverTimestamp } from 'firebase/firestore';
import Slider from '@react-native-community/slider';

const COMMON_SYMPTOMS = [
  'Itching', 'Rash', 'Hives', 'Swelling', 'Sneezing',
  'Runny nose', 'Watery eyes', 'Coughing', 'Wheezing',
  'Shortness of breath', 'Nausea', 'Stomach pain', 'Diarrhea',
  'Headache', 'Dizziness', 'Throat tightness', 'Fatigue'
];

export default function FoodLogScreen() {
  // Allergy reaction states
  const [severity, setSeverity] = useState(5);
  const [symptoms, setSymptoms] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentReactions, setRecentReactions] = useState([]);
  const [fetchingReactions, setFetchingReactions] = useState(true);
  
  useEffect(() => {
    fetchRecentReactions();
  }, []);
  
  const fetchRecentReactions = async () => {
    try {
      setFetchingReactions(true);
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        console.log('No current user found');
        return;
      }
      
      console.log('Fetching reactions for user:', currentUser.uid);
      const userRef = doc(firestore, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const reactions = userData.allergy_reactions || [];
        console.log('Found reactions:', reactions.length);
        
        // Sort by timestamp, most recent first
        const sortedReactions = reactions.sort((a, b) => {
          const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp);
          const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp);
          return bTime - aTime;
        });
        setRecentReactions(sortedReactions.slice(0, 10)); // Show last 10 reactions
      } else {
        console.log('User document does not exist');
        setRecentReactions([]);
      }
    } catch (error) {
      console.error('Error fetching reactions:', error);
      Alert.alert('Error', `Failed to load reaction history: ${error.message}`);
    } finally {
      setFetchingReactions(false);
    }
  };

  const toggleSymptom = (symptom) => {
    if (symptoms.includes(symptom)) {
      setSymptoms(symptoms.filter(item => item !== symptom));
    } else {
      setSymptoms([...symptoms, symptom]);
    }
  };

  const reportReaction = async () => {
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
      
      // Create allergy report
      const report = {
        severity: Math.round(severity),
        symptoms: symptoms,
        notes: notes.trim(),
        timestamp: new Date()
      };
      
      // Add to user's allergy reactions array
      const userRef = doc(firestore, 'users', currentUser.uid);
      
      try {
        // First ensure user document exists
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          await setDoc(userRef, { allergy_reactions: [] });
        }
        
        // Add reaction to user's array
        await setDoc(userRef, { 
          allergy_reactions: arrayUnion(report) 
        }, { merge: true });
        
        console.log('Reaction saved to user document');
        
        // Note: Skipping separate collection to avoid permission issues
        // The user document storage is sufficient for the allergy risk calculation
      } catch (firebaseError) {
        console.error('Firebase error details:', firebaseError);
        throw new Error(`Failed to save to Firebase: ${firebaseError.message}`);
      }
      
      // Clear form
      setSymptoms([]);
      setNotes('');
      setSeverity(5);
      
      // Refresh reactions list
      fetchRecentReactions();
      
      Alert.alert(
        'Reaction Reported',
        'Your allergy reaction has been recorded. This will help improve your personalized risk assessment.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error reporting reaction:', error);
      Alert.alert(
        'Error Saving Reaction', 
        `Failed to save your reaction report: ${error.message}`,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Unknown date';
    
    const reactionDate = date.toDate ? date.toDate() : new Date(date);
    return reactionDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSeverityColor = (sev) => {
    if (sev <= 3) return '#4CAF50'; // Green for mild
    if (sev <= 6) return '#FF9800'; // Orange for moderate
    return '#F44336'; // Red for severe
  };

  const getSeverityLabel = (sev) => {
    if (sev <= 3) return 'Mild';
    if (sev <= 6) return 'Moderate';
    return 'Severe';
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Report Allergy Reaction</Text>
        <Text style={styles.subtitle}>
          Help us track your reactions to improve your personalized risk assessment
        </Text>
        
        {/* Severity Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reaction Severity</Text>
          <Text style={styles.subtitle}>Rate how severe your reaction was (1-10)</Text>
          
          <View style={styles.sliderContainer}>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={10}
              value={severity}
              onValueChange={setSeverity}
              step={1}
              minimumTrackTintColor="#00CED1"
              maximumTrackTintColor="#E0E0E0"
              thumbStyle={styles.sliderThumb}
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabel}>Mild</Text>
              <View style={styles.severityDisplay}>
                <Text style={[styles.severityValue, { color: getSeverityColor(severity) }]}>
                  {Math.round(severity)}
                </Text>
                <Text style={[styles.severityLabel, { color: getSeverityColor(severity) }]}>
                  {getSeverityLabel(severity)}
                </Text>
              </View>
              <Text style={styles.sliderLabel}>Severe</Text>
            </View>
          </View>
        </View>

        {/* Symptoms Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Symptoms</Text>
          <Text style={styles.subtitle}>Select all symptoms you experienced</Text>
          
          <View style={styles.symptomsContainer}>
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

        
        {/* Notes Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes</Text>
          <TextInput
            mode="outlined"
            label="Any additional details about this reaction"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            style={styles.input}
            placeholder="When did it start? How long did it last? What helped?"
          />
        </View>
        
        {/* Submit Button */}
        <Button
          mode="contained"
          onPress={reportReaction}
          loading={loading}
          disabled={loading || symptoms.length === 0}
          style={styles.submitButton}
          contentStyle={styles.submitButtonContent}
        >
          Report Reaction
        </Button>
        
        {/* Recent Reactions */}
        <Divider style={styles.divider} />
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Reactions</Text>
          
          {fetchingReactions ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#00CED1" />
              <Text style={styles.loadingText}>Loading reactions...</Text>
            </View>
          ) : recentReactions.length > 0 ? (
            recentReactions.map((reaction, index) => (
              <View key={index} style={styles.reactionItem}>
                <View style={styles.reactionHeader}>
                  <Text style={styles.reactionDate}>
                    {formatDate(reaction.timestamp)}
                  </Text>
                  <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(reaction.severity) }]}>
                    <Text style={styles.severityBadgeText}>
                      {getSeverityLabel(reaction.severity)} ({reaction.severity}/10)
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.reactionSymptoms}>
                  <Text style={styles.label}>Symptoms: </Text>
                  {reaction.symptoms.join(', ')}
                </Text>
                
                {reaction.notes && (
                  <Text style={styles.reactionNotes}>
                    <Text style={styles.label}>Notes: </Text>
                    {reaction.notes}
                  </Text>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>
              No reactions reported yet. Use the form above to report your first reaction.
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0FFFF',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#008B8B',
  },
  subtitle: {
    fontSize: 16,
    color: '#20B2AA',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#008B8B',
  },
  sliderContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#F0FFFF',
    borderRadius: 12,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#20B2AA',
  },
  severityDisplay: {
    alignItems: 'center',
  },
  severityValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  severityLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sliderThumb: {
    backgroundColor: '#00CED1',
  },
  symptomsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: 16,
  },
  chip: {
    margin: 4,
    backgroundColor: '#FFFFFF',
  },
  selectedSymptoms: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F0FFFF',
    borderRadius: 8,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#008B8B',
    marginBottom: 8,
  },
  symptomsText: {
    fontSize: 14,
    color: '#20B2AA',
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: '#00CED1',
    marginTop: 16,
  },
  submitButtonContent: {
    paddingVertical: 8,
  },
  divider: {
    backgroundColor: '#B0E0E6',
    height: 1,
    marginVertical: 24,
  },
  reactionItem: {
    backgroundColor: '#F0FFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#00CED1',
  },
  reactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reactionDate: {
    fontSize: 14,
    color: '#008B8B',
    fontWeight: '600',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  reactionSymptoms: {
    fontSize: 14,
    color: '#20B2AA',
    marginBottom: 4,
  },
  reactionNotes: {
    fontSize: 14,
    color: '#20B2AA',
    fontStyle: 'italic',
  },
  label: {
    fontWeight: '600',
    color: '#008B8B',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#008B8B',
  },
  noDataText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#20B2AA',
    fontStyle: 'italic',
    padding: 20,
  },
});