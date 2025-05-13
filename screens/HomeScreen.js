import React, { useState, useEffect, useContext } from 'react';
import { 
  StyleSheet, View, Text, TouchableOpacity, ScrollView, 
  RefreshControl, Alert 
} from 'react-native';
import { Card, Title, Paragraph, Button, ActivityIndicator } from 'react-native-paper';
import { doc, getDoc, collection, query, orderBy, limit, getDocs, serverTimestamp, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, firestore } from '../firebase';
import { UserContext } from '../context/UserContext';
import { getRiskColor, fetchEnvironmentalData } from '../utils/helpers';
import { API_URL } from '../config';

export default function HomeScreen({ navigation }) {
  const { userData, setUserData } = useContext(UserContext);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [environmentalData, setEnvironmentalData] = useState(null);
  const [recentFoodLogs, setRecentFoodLogs] = useState([]);

  useEffect(() => {
    fetchUserData();
    fetchLatestPrediction();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      
      if (currentUser) {
        const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
          
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);
          
          // Get most recent food logs
          const recentLogs = data.food_logs ? 
            data.food_logs.slice(-3).reverse() : 
            [];
          setRecentFoodLogs(recentLogs);
        }
      }
      
      // Fetch environmental data
      const envData = await fetchEnvironmentalData();
      setEnvironmentalData(envData);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load your data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLatestPrediction = async () => {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) return;
      
      // Get latest prediction from Firestore
      const predictionsQuery = query(
        collection(firestore, 'users', currentUser.uid, 'predictions'),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      
      const predictionsSnapshot = await getDocs(predictionsQuery);
        
      if (!predictionsSnapshot.empty) {
        setPrediction(predictionsSnapshot.docs[0].data());
      } else {
        // If no prediction exists, request a new one
        requestNewPrediction();
      }
    } catch (error) {
      console.error('Error fetching prediction:', error);
    }
  };

  const requestNewPrediction = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      
      if (!currentUser) return;
      
      // Request prediction from API
      const response = await fetch(`${API_URL}/api/predict/allergy-risk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: currentUser.uid }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setPrediction(result.prediction);
        
        // Store prediction in Firestore
        await addDoc(
          collection(firestore, 'users', currentUser.uid, 'predictions'),
          {
            ...result.prediction,
            timestamp: serverTimestamp(),
          }
        );
      } else {
        throw new Error(result.error || 'Failed to get prediction');
      }
    } catch (error) {
      console.error('Error getting prediction:', error);
      Alert.alert('Error', 'Failed to get your allergy risk prediction.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserData();
    await requestNewPrediction();
    setRefreshing(false);
  };

  const handleAllergyReport = () => {
    navigation.navigate('AllergyLog');
  };


  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* User greeting */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Hello, {userData?.name || 'there'}!
        </Text>
        <Text style={styles.subGreeting}>
          Here's your allergy update for today
        </Text>
      </View>
      
      {/* Risk prediction card */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Current Allergy Risk</Title>
          {prediction ? (
            <>
              <View style={styles.riskIndicatorContainer}>
                <View 
                  style={[
                    styles.riskIndicator, 
                    { backgroundColor: getRiskColor(prediction.risk_level) }
                  ]}
                >
                  <Text style={styles.riskText}>
                    {Math.round(prediction.risk_level * 100)}%
                  </Text>
                </View>
                <View style={styles.riskDescription}>
                  <Text style={styles.riskLabel}>
                    {prediction.risk_level < 0.3 ? 'Low Risk' : 
                     prediction.risk_level < 0.7 ? 'Medium Risk' : 'High Risk'}
                  </Text>
                  <Text style={styles.riskDetails}>
                    Confidence: {Math.round(prediction.confidence * 100)}%
                  </Text>
                </View>
              </View>
              
              <View style={styles.factorsContainer}>
                <Text style={styles.factorsTitle}>Contributing Factors:</Text>
                {prediction.contributing_factors.map((factor, index) => (
                  <Text key={index} style={styles.factor}>
                    • {factor.replace(/_/g, ' ')}
                  </Text>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.noPrediction}>
              <Text>No prediction available</Text>
              <Button 
                mode="contained" 
                onPress={requestNewPrediction}
                style={styles.refreshButton}
              >
                Get Prediction
              </Button>
            </View>
          )}
        </Card.Content>
      </Card>
      
      {/* Environmental data card */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Environmental Conditions</Title>
          {environmentalData ? (
            <View style={styles.environmentalData}>
              <View style={styles.envRow}>
                <View style={styles.envItem}>
                  <Text style={styles.envLabel}>Pollen</Text>
                  <Text style={styles.envValue}>
                    {environmentalData.pollen_level} 
                    <Text style={styles.envUnit}> (index)</Text>
                  </Text>
                </View>
                <View style={styles.envItem}>
                  <Text style={styles.envLabel}>Air Quality</Text>
                  <Text style={styles.envValue}>
                    {environmentalData.air_quality}
                    <Text style={styles.envUnit}> (AQI)</Text>
                  </Text>
                </View>
              </View>
              <View style={styles.envRow}>
                <View style={styles.envItem}>
                  <Text style={styles.envLabel}>Temperature</Text>
                  <Text style={styles.envValue}>
                    {environmentalData.temperature}°C
                  </Text>
                </View>
                <View style={styles.envItem}>
                  <Text style={styles.envLabel}>Humidity</Text>
                  <Text style={styles.envValue}>
                    {environmentalData.humidity}%
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <Text>Environmental data unavailable</Text>
          )}
        </Card.Content>
      </Card>
      
      {/* Recent food logs */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Recent Food Logs</Title>
          {recentFoodLogs.length > 0 ? (
            recentFoodLogs.map((log, index) => (
              <View key={index} style={styles.foodLog}>
                <Text style={styles.foodLogDate}>
                  {log.timestamp ? new Date(log.timestamp.toDate()).toLocaleDateString() : 'Unknown date'}
                </Text>
                <View style={styles.foodItems}>
                  {log.items.map((item, i) => (
                    <Text key={i} style={styles.foodItem}>• {item}</Text>
                  ))}
                </View>
                {log.notes && <Text style={styles.foodNotes}>Note: {log.notes}</Text>}
              </View>
            ))
          ) : (
            <Text>No recent food logs available</Text>
          )}
          <Button 
            mode="outlined" 
            onPress={() => navigation.navigate('Food Log')}
            style={styles.viewMoreButton}
          >
            Log Food
          </Button>
        </Card.Content>
      </Card>
      
      {/* Report allergy button */}
      <TouchableOpacity 
        style={styles.reportButton} 
        onPress={handleAllergyReport}
      >
        <Text style={styles.reportButtonText}>Report Allergy Reaction</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subGreeting: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
    borderRadius: 8,
  },
  riskIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  riskIndicator: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  riskText: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },
  riskDescription: {
    flex: 1,
  },
  riskLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  riskDetails: {
    fontSize: 14,
    color: '#666',
  },
  factorsContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  factorsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  factor: {
    fontSize: 14,
    marginBottom: 4,
    color: '#333',
  },
  noPrediction: {
    alignItems: 'center',
    padding: 20,
  },
  refreshButton: {
    marginTop: 12,
  },
  environmentalData: {
    marginTop: 8,
  },
  envRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  envItem: {
    flex: 1,
    padding: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  envLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  envValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  envUnit: {
    fontSize: 12,
    fontWeight: 'normal',
    color: '#666',
  },
  foodLog: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  foodLogDate: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  foodItems: {
    marginBottom: 8,
  },
  foodItem: {
    fontSize: 14,
    marginBottom: 4,
  },
  foodNotes: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#666',
  },
  viewMoreButton: {
    marginTop: 8,
  },
  reportButton: {
    backgroundColor: '#ff6b6b',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 16,
  },
  reportButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});