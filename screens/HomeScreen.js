console.log('HomeScreen: Module loaded.');

import React, { useState, useEffect, useContext } from 'react';
import { 
  StyleSheet, View, Text, TouchableOpacity, ScrollView, 
  RefreshControl, Alert 
} from 'react-native';
import { Card, Title, Paragraph, Button, ActivityIndicator } from 'react-native-paper';
import { UserContext } from '../context/UserContext';
import { getRiskColor, fetchEnvironmentalData } from '../utils/helpers';
import { API_URL } from '../config';
import { doc, collection, query, orderBy, limit, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, firestore } from '../firebase';

export default function HomeScreen({ navigation }) {
  const { userData, loading: userDataLoading } = useContext(UserContext);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [environmentalData, setEnvironmentalData] = useState(null);
  const [recentFoodLogs, setRecentFoodLogs] = useState([]);

  useEffect(() => {
    console.log('HomeScreen: Mounted. Starting useEffect.');
    
    const loadAdditionalData = async () => {
      try {
        setLoading(true);
        const currentUser = auth.currentUser;
        
        if (!currentUser) {
          console.log('HomeScreen: No user found');
          return;
        }

        console.log('HomeScreen: Loading additional data for user:', currentUser.uid);
        
        // Get most recent food logs from userData
        if (userData && userData.food_logs) {
          const recentLogs = userData.food_logs.slice(-3).reverse();
          setRecentFoodLogs(recentLogs);
        }
        
        // Fetch environmental data
        const envData = await fetchEnvironmentalData();
        setEnvironmentalData(envData);
        
        // Get latest prediction
        await fetchLatestPrediction(currentUser);
      } catch (error) {
        console.error('HomeScreen: Error loading additional data:', error);
        Alert.alert('Error', 'Failed to load some data');
      } finally {
        setLoading(false);
      }
    };

    if (userData) {
      loadAdditionalData();
    }
  }, [userData]); // Re-run when userData changes

  const fetchLatestPrediction = async (currentUser) => {
    try {
      // Get latest prediction from Firestore
      const predictionsQuery = query(
        collection(firestore, 'users', currentUser.uid, 'predictions'),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      
      const predictionsSnapshot = await getDocs(predictionsQuery);
        
      if (!predictionsSnapshot.empty) {
        const predictionData = predictionsSnapshot.docs[0].data();
        setPrediction(predictionData);
      } else {
        // If no prediction exists, request a new one
        requestNewPrediction(0);
      }
    } catch (error) {
      console.error('Error fetching prediction:', error);
      Alert.alert('Error', 'Failed to load prediction data');
    }
  };

  const requestNewPrediction = async (retryCount = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds

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
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setPrediction(result.prediction);
        
        // Store prediction in Firestore
        await setDoc(doc(firestore, 'users', currentUser.uid, 'predictions', result.prediction.id || Date.now().toString()), {
          ...result.prediction,
          timestamp: serverTimestamp(),
        });
      } else {
        throw new Error(result.error || 'Failed to get prediction');
      }
    } catch (error) {
      console.error('Error getting prediction:', error);
      
      // Retry logic for network errors
      if (retryCount < MAX_RETRIES && 
          (error.message.includes('Network request failed') || 
           error.message.includes('Could not reach Cloud Firestore backend'))) {
        console.log(`Retrying prediction request (${retryCount + 1}/${MAX_RETRIES})...`);
        setTimeout(() => {
          requestNewPrediction(retryCount + 1);
        }, RETRY_DELAY);
        return;
      }
      
      Alert.alert(
        'Connection Error',
        'Unable to get prediction. Please check your internet connection and try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => requestNewPrediction(0) }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        await fetchLatestPrediction(currentUser);
        const envData = await fetchEnvironmentalData();
        setEnvironmentalData(envData);
      }
    } catch (error) {
      console.error('HomeScreen: Error refreshing data:', error);
      Alert.alert('Error', 'Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const handleAllergyReport = () => {
    navigation.navigate('AllergyLog');
  };

  if (userDataLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00CED1" />
        <Text style={styles.loadingText}>Loading your data...</Text>
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No user data available</Text>
        <Button 
          mode="contained" 
          onPress={() => navigation.navigate('Login')}
          style={styles.loginButton}
        >
          Go to Login
        </Button>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#4CAF50" // Match theme primary color
        />
      }
    >
      {/* User greeting */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Hello, {userData?.name || 'there'}!
        </Text>
        <Text style={styles.subGreeting}>
          Here's your Sniffle update for today
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
                onPress={() => {
                  requestNewPrediction(0);
                }}
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
            labelStyle={{ color: '#008B8B' }}
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
    backgroundColor: '#E0FFFF', // Light Cyan
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
    color: '#008B8B', // Dark Cyan
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#008B8B', // Dark Cyan
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  subGreeting: {
    fontSize: 18,
    color: '#20B2AA', // Light Sea Green
    marginTop: 4,
  },
  card: {
    marginBottom: 20,
    elevation: 4,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  riskIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  riskIndicator: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    backgroundColor: '#00CED1', // Deep Turquoise
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  riskText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  riskDescription: {
    flex: 1,
  },
  riskLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#008B8B', // Dark Cyan
  },
  riskDetails: {
    fontSize: 16,
    color: '#20B2AA', // Light Sea Green
  },
  factorsContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#F0FFFF', // Azure
    borderRadius: 12,
  },
  factorsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#008B8B', // Dark Cyan
  },
  factor: {
    fontSize: 16,
    marginBottom: 8,
    color: '#20B2AA', // Light Sea Green
  },
  noPrediction: {
    alignItems: 'center',
    padding: 24,
  },
  refreshButton: {
    marginTop: 16,
    backgroundColor: '#00CED1', // Deep Turquoise
  },
  environmentalData: {
    marginTop: 12,
  },
  envRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  envItem: {
    flex: 1,
    padding: 12,
    backgroundColor: '#F0FFFF', // Azure
    borderRadius: 12,
    marginHorizontal: 6,
    elevation: 2,
  },
  envLabel: {
    fontSize: 16,
    color: '#008B8B', // Dark Cyan
    marginBottom: 6,
    fontWeight: '600',
  },
  envValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00CED1', // Deep Turquoise
  },
  envUnit: {
    fontSize: 14,
    fontWeight: 'normal',
    color: '#20B2AA', // Light Sea Green
  },
  foodLog: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#F0FFFF', // Azure
    borderRadius: 12,
  },
  foodLogDate: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#008B8B', // Dark Cyan
  },
  foodItems: {
    marginBottom: 12,
  },
  foodItem: {
    fontSize: 16,
    marginBottom: 6,
    color: '#20B2AA', // Light Sea Green
  },
  foodNotes: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#008B8B', // Dark Cyan
  },
  viewMoreButton: {
    marginTop: 12,
    borderColor: '#00CED1', // Deep Turquoise
  },
  reportButton: {
    backgroundColor: '#00CED1', // Deep Turquoise
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  reportButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    marginBottom: 20,
    fontSize: 16,
    color: '#008B8B', // Dark Cyan
  },
  loginButton: {
    backgroundColor: '#00CED1', // Deep Turquoise
  },
});