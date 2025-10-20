console.log('HomeScreen: Module loaded.');

import React, { useState, useEffect, useContext } from 'react';
import { 
  StyleSheet, View, Text, TouchableOpacity, ScrollView, 
  RefreshControl, Alert 
} from 'react-native';
import { Card, Title, Paragraph, Button, ActivityIndicator } from 'react-native-paper';
import { UserContext } from '../context/UserContext';
import { getRiskColor, fetchEnvironmentalData, calculateAllergyRisk } from '../utils/helpers';

// Helper functions for allergy severity
const getSeverityColor = (severity) => {
  if (severity <= 3) return '#4CAF50'; // Green for mild
  if (severity <= 6) return '#FF9800'; // Orange for moderate
  return '#F44336'; // Red for severe
};

const getSeverityLabel = (severity) => {
  if (severity <= 3) return 'Mild';
  if (severity <= 6) return 'Moderate';
  return 'Severe';
};
import { API_URL } from '../config';
import { doc, collection, query, orderBy, limit, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, firestore } from '../firebase';

export default function HomeScreen({ navigation }) {
  const { userData, loading: userDataLoading } = useContext(UserContext);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [environmentalData, setEnvironmentalData] = useState(null);
  const [environmentalError, setEnvironmentalError] = useState(null);
  const [recentAllergyLogs, setRecentAllergyLogs] = useState([]);

  useEffect(() => {
    console.log('HomeScreen: Mounted. Starting useEffect.');
    
    const loadAdditionalData = async () => {
      try {
        setLoading(true);
        const currentUser = auth.currentUser;
        
        if (!currentUser) {
          console.log('HomeScreen: No user found');
          setLoading(false);
          return;
        }

        console.log('HomeScreen: Loading additional data for user:', currentUser.uid);
        
        // Add overall timeout for entire loading process
        const startTime = Date.now();
        const MAX_LOAD_TIME = 15000; // 15 seconds max
        
        // Get most recent allergy reactions from userData
        if (userData && userData.allergy_reactions) {
          const recentReactions = userData.allergy_reactions.slice(-3).reverse();
          setRecentAllergyLogs(recentReactions);
        }
        
        // Fetch environmental data with improved error handling
        try {
          console.log('HomeScreen: Starting environmental data fetch...');
          const envData = await fetchEnvironmentalData();
          console.log('HomeScreen: Got environmental data:', envData);
          setEnvironmentalData(envData);
        } catch (error) {
          console.error('HomeScreen: Failed to get environmental data:', error);
          setEnvironmentalData(null);
          
          // Store error info for user feedback
          setEnvironmentalError(error.message);
        }
        
        // Get latest prediction with timeout check
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime < MAX_LOAD_TIME) {
          await fetchLatestPrediction(currentUser);
        } else {
          console.log('HomeScreen: Skipping prediction fetch due to timeout');
        }
        
        console.log('HomeScreen: Data loading completed in', Date.now() - startTime, 'ms');
      } catch (error) {
        console.error('HomeScreen: Error loading additional data:', error);
        // Don't show alert during initial load
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
      console.log('HomeScreen: Fetching latest prediction for user:', currentUser.uid);
      // Get latest prediction from Firestore
      const predictionsQuery = query(
        collection(firestore, 'users', currentUser.uid, 'predictions'),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      
      const predictionsSnapshot = await getDocs(predictionsQuery);
        
      if (!predictionsSnapshot.empty) {
        const predictionData = predictionsSnapshot.docs[0].data();
        console.log('HomeScreen: Found existing prediction');
        setPrediction(predictionData);
      } else {
        console.log('HomeScreen: No existing prediction, generating new one');
        // If no prediction exists, request a new one but don't block loading
        requestNewPrediction(0);
      }
    } catch (error) {
      console.error('HomeScreen: Error fetching prediction:', error);
      // Don't show alert during loading, just log and continue
      setPrediction(null);
    }
  };

  const requestNewPrediction = async (retryCount = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds

    try {
      console.log('HomeScreen: Requesting new prediction, retry count:', retryCount);
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        console.log('HomeScreen: No current user for prediction request');
        return;
      }
      
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
      console.error('HomeScreen: Error getting prediction:', error);
      
      // Retry logic for network errors
      if (retryCount < MAX_RETRIES && 
          (error.message.includes('Network request failed') || 
           error.message.includes('Could not reach Cloud Firestore backend'))) {
        console.log(`HomeScreen: Retrying prediction request (${retryCount + 1}/${MAX_RETRIES})...`);
        setTimeout(() => {
          requestNewPrediction(retryCount + 1);
        }, RETRY_DELAY);
        return;
      }
      
      // Don't show alert if we're still loading the main screen
      if (!loading) {
        Alert.alert(
          'Prediction Error',
          'Unable to get allergy prediction. You can try refreshing later.',
          [{ text: 'OK' }]
        );
      }
      
      // Set prediction to null so the screen can still load
      setPrediction(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setEnvironmentalError(null); // Clear previous errors
    
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        await fetchLatestPrediction(currentUser);
        
        try {
          const envData = await fetchEnvironmentalData();
          setEnvironmentalData(envData);
          setEnvironmentalError(null);
        } catch (envError) {
          console.error('HomeScreen: Error refreshing environmental data:', envError);
          setEnvironmentalData(null);
          setEnvironmentalError(envError.message);
          
          // Show user-friendly error alert on manual refresh
          Alert.alert(
            'Environmental Data Error',
            `Unable to fetch current environmental conditions: ${envError.message}`,
            [{ text: 'OK' }]
          );
        }
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
      
      {/* Allergy Risk Assessment */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Today's Allergy Risk</Title>
          {environmentalData ? (() => {
            const allergyRisk = calculateAllergyRisk(environmentalData, userData);
            return (
              <>
                {/* Overall Allergy Risk */}
                <View style={[styles.allergyRiskContainer, { backgroundColor: allergyRisk.color + '15' }]}>
                  <View style={styles.riskHeader}>
                    <View style={styles.riskBadgeContainer}>
                      <View style={[styles.riskBadge, { backgroundColor: allergyRisk.color }]}>
                        <Text style={styles.riskBadgeText}>{allergyRisk.description}</Text>
                      </View>
                      <View style={styles.riskScoreContainer}>
                        <Text style={styles.riskScoreNumber}>{allergyRisk.score}</Text>
                        <Text style={styles.riskScoreMax}>%</Text>
                      </View>
                    </View>
                
                  </View>
                  
                  {/* Contributing factors */}
                  <View style={styles.factorsSection}>
                    <Text style={styles.factorsLabel}>Key Factors:</Text>
                    {allergyRisk.factors.slice(0, 3).map((factor, index) => (
                      <Text key={index} style={styles.factorItem}>• {factor}</Text>
                    ))}
                  </View>
                  
                  {/* Top recommendations */}
                  <View style={styles.recommendationsSection}>
                    <Text style={styles.recommendationsLabel}>Recommendations:</Text>
                    {allergyRisk.recommendations.slice(0, 2).map((rec, index) => (
                      <Text key={index} style={styles.recommendationItem}>• {rec}</Text>
                    ))}
                  </View>
                </View>
              </>
            );
          })() : (
            <View style={styles.noPrediction}>
              <ActivityIndicator size="small" color="#00CED1" />
              <Text style={styles.envSubtext}>Calculating allergy risk...</Text>
            </View>
          )}
        </Card.Content>
      </Card>
      
      {/* Environmental Conditions */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Environmental Conditions</Title>
          {environmentalData ? (
            <View style={styles.environmentalData}>
              <View style={styles.envRow}>
                <View style={styles.envItem}>
                  <Text style={styles.envLabel}>Pollen Level</Text>
                  <Text style={styles.envValue}>
                    {environmentalData.pollen_risk?.charAt(0).toUpperCase() + environmentalData.pollen_risk?.slice(1) || 'Moderate'}
                  </Text>
                  <Text style={styles.envSubtext}>Tree, grass & weed pollen</Text>
                </View>
                <View style={styles.envItem}>
                  <Text style={styles.envLabel}>Air Quality</Text>
                  <Text style={styles.envValue}>
                    {environmentalData.air_quality <= 2 ? 'Good' : 
                     environmentalData.air_quality <= 3 ? 'Moderate' : 
                     environmentalData.air_quality <= 4 ? 'Poor' : 'Very Poor'}
                  </Text>
                  <Text style={styles.envSubtext}>Safe for outdoor activities</Text>
                </View>
              </View>
              <View style={styles.envRow}>
                <View style={styles.envItem}>
                  <Text style={styles.envLabel}>Weather</Text>
                  <Text style={styles.envValue}>
                    {environmentalData.temperature}°C
                  </Text>
                  <Text style={styles.envSubtext}>{environmentalData.weather_condition || 'Clear'}</Text>
                </View>
                <View style={styles.envItem}>
                  <Text style={styles.envLabel}>Location</Text>
                  <Text style={styles.envValue}>
                    {environmentalData.city || 'Current'}
                  </Text>
                  <Text style={styles.envSubtext}>
                    {environmentalData.region ? `${environmentalData.region} • Now` : 'Real-time'}
                  </Text>
                </View>
              </View>
            </View>
          ) : environmentalError ? (
            <View style={styles.errorState}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorTitle}>Unable to load environmental data</Text>
              <Text style={styles.errorMessage}>{environmentalError}</Text>
              <Button 
                mode="outlined" 
                onPress={() => {
                  setEnvironmentalError(null);
                  fetchEnvironmentalData().then(setEnvironmentalData).catch(err => setEnvironmentalError(err.message));
                }}
                style={styles.retryButton}
                labelStyle={{ color: '#008B8B' }}
              >
                Retry
              </Button>
            </View>
          ) : (
            <View style={styles.noPrediction}>
              <ActivityIndicator size="small" color="#00CED1" />
              <Text style={styles.envSubtext}>Loading environmental data...</Text>
            </View>
          )}
        </Card.Content>
      </Card>
      
      {/* Recent allergy reactions */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={{ marginBottom: 16 }}>Recent Allergy Reactions</Title>
          {recentAllergyLogs.length > 0 ? (
            recentAllergyLogs.map((reaction, index) => (
              <View key={index} style={styles.allergyLog}>
                <View style={styles.allergyLogHeader}>
                  <Text style={styles.allergyLogDate}>
                    {reaction.timestamp ? new Date(reaction.timestamp.toDate ? reaction.timestamp.toDate() : reaction.timestamp).toLocaleDateString() : 'Unknown date'}
                  </Text>
                  <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(reaction.severity) }]}>
                    <Text style={styles.severityBadgeText}>
                      {getSeverityLabel(reaction.severity)}
                    </Text>
                  </View>
                </View>
                <View style={styles.allergySymptoms}>
                  <Text style={styles.symptomsLabel}>Symptoms:</Text>
                  <Text style={styles.symptomsText}>
                    {reaction.symptoms.slice(0, 3).join(', ')}
                    {reaction.symptoms.length > 3 && ` +${reaction.symptoms.length - 3} more`}
                  </Text>
                </View>
                {reaction.notes && <Text style={styles.allergyNotes}>Note: {reaction.notes}</Text>}
              </View>
            ))
          ) : (
            <Text>No recent allergy reactions recorded</Text>
          )}
          <Button 
            mode="outlined" 
            onPress={() => navigation.navigate('Allergy Log')}
            style={styles.viewMoreButton}
            labelStyle={{ color: '#008B8B' }}
          >
            Report Reaction
          </Button>
        </Card.Content>
      </Card>
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
  envSubtext: {
    fontSize: 12,
    color: '#008B8B', // Dark Cyan
    marginTop: 4,
    textTransform: 'capitalize',
  },
  allergyLog: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#F0FFFF', // Azure
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#00CED1',
  },
  allergyLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  allergyLogDate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#008B8B', // Dark Cyan
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
  allergySymptoms: {
    marginBottom: 8,
  },
  symptomsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#008B8B',
    marginBottom: 4,
  },
  symptomsText: {
    fontSize: 14,
    color: '#20B2AA',
    lineHeight: 18,
  },
  allergyNotes: {
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
  errorState: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E65100',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#F57C00',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  retryButton: {
    borderColor: '#FF9800',
    marginTop: 8,
  },
  allergyRiskContainer: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  riskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  riskBadgeContainer: {
    alignItems: 'flex-start',
  },
  riskBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    marginBottom: 8,
  },
  riskBadgeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  riskScoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    elevation: 1,
  },
  riskScoreNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#008B8B',
  },
  riskScoreMax: {
    fontSize: 16,
    color: '#666',
    marginLeft: 2,
  },
  personalizedIndicator: {
    fontSize: 10,
    color: '#0066CC',
    fontWeight: '600',
    marginLeft: 8,
    textTransform: 'uppercase',
  },
  riskLocation: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  factorsSection: {
    marginBottom: 16,
  },
  factorsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#008B8B',
    marginBottom: 8,
  },
  factorItem: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
    lineHeight: 18,
  },
  recommendationsSection: {
    marginBottom: 8,
  },
  recommendationsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#008B8B',
    marginBottom: 8,
  },
  recommendationItem: {
    fontSize: 14,
    color: '#0066CC',
    marginBottom: 4,
    lineHeight: 18,
  },
  detailsSection: {
    backgroundColor: '#F8FFFF',
    borderRadius: 12,
    padding: 16,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#008B8B',
    marginBottom: 12,
  },
});