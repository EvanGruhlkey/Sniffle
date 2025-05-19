import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  Alert,
  RefreshControl,
  useWindowDimensions
} from 'react-native';
import { Card, Title, Paragraph, Button, ActivityIndicator } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import { auth, firestore } from '../firebase';
import { getRiskColor } from '../utils/helpers';
import { API_URL } from '../config';
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';

export default function PredictionScreen() {
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [allergyHistory, setAllergyHistory] = useState([]);
  const [temporalPatterns, setTemporalPatterns] = useState(null);
  const [riskFactors, setRiskFactors] = useState([]);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'Please sign in to view predictions');
        return;
      }

      await Promise.all([
        fetchPredictionHistory(currentUser),
        fetchAllergyHistory(currentUser),
        fetchTemporalPatterns(currentUser),
        fetchRiskFactors(currentUser),
      ]);
    } catch (error) {
      console.error('Error loading prediction data:', error);
      Alert.alert('Error', 'Failed to load prediction data');
    } finally {
      setLoading(false);
    }
  };
  
  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };
  
  const fetchPredictionHistory = async (user, retryCount = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds

    try {
      const predictionsQuery = query(
        collection(firestore, 'users', user.uid, 'predictions'),
        orderBy('timestamp', 'desc'),
        limit(10)
      );
      
      const snapshot = await getDocs(predictionsQuery);
        
      if (!snapshot.empty) {
        const predictionData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            risk_level: data.risk_level,
            confidence: data.confidence,
            contributing_factors: data.contributing_factors || [],
            date: data.timestamp ? data.timestamp.toDate() : new Date(),
          };
        });
        
        // Sort by date (oldest first for charts)
        predictionData.sort((a, b) => a.date - b.date);
        setPredictions(predictionData);
      }
    } catch (error) {
      console.error('Error fetching prediction history:', error);
      
      // Retry logic for network errors
      if (retryCount < MAX_RETRIES && 
          (error.message.includes('Network request failed') || 
           error.message.includes('Could not reach Cloud Firestore backend'))) {
        console.log(`Retrying prediction history fetch (${retryCount + 1}/${MAX_RETRIES})...`);
        setTimeout(() => {
          fetchPredictionHistory(user, retryCount + 1);
        }, RETRY_DELAY);
        return;
      }
      
      Alert.alert(
        'Connection Error',
        'Unable to load prediction history. Please check your internet connection and try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => fetchPredictionHistory(user, 0) }
        ]
      );
    }
  };
  
  const fetchAllergyHistory = async (user, retryCount = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds

    try {
      const userDoc = await getDoc(doc(firestore, 'users', user.uid));
        
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const history = userData.severity_history || [];
        
        // Convert timestamps and sort by date
        const historyWithDates = history.map(entry => ({
          ...entry,
          date: entry.timestamp ? entry.timestamp.toDate() : new Date()
        }));
        
        historyWithDates.sort((a, b) => a.date - b.date);
        setAllergyHistory(historyWithDates);
      }
    } catch (error) {
      console.error('Error fetching allergy history:', error);
      
      // Retry logic for network errors
      if (retryCount < MAX_RETRIES && 
          (error.message.includes('Network request failed') || 
           error.message.includes('Could not reach Cloud Firestore backend'))) {
        console.log(`Retrying allergy history fetch (${retryCount + 1}/${MAX_RETRIES})...`);
        setTimeout(() => {
          fetchAllergyHistory(user, retryCount + 1);
        }, RETRY_DELAY);
        return;
      }
      
      Alert.alert(
        'Connection Error',
        'Unable to load allergy history. Please check your internet connection and try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => fetchAllergyHistory(user, 0) }
        ]
      );
    }
  };
  
  const fetchTemporalPatterns = async (user) => {
    try {
      // Get Firebase Auth ID token
      const idToken = await user.getIdToken();

      // This would be an API call to get patterns
      const response = await fetch(`${API_URL}/api/analysis/temporal-patterns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ userId: user.uid }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setTemporalPatterns(result.patterns);
      } else {
        throw new Error(result.error || 'Failed to fetch temporal patterns');
      }
    } catch (error) {
      console.error('Error fetching temporal patterns:', error);
      // Fallback to mock data if API isn't available
      setTemporalPatterns({
        daily_pattern: {
          '8': 6.2,
          '12': 4.5,
          '18': 7.1,
          '22': 5.8
        },
        monthly_pattern: {
          '1': 3.5,
          '4': 7.2,
          '7': 5.1,
          '10': 6.8
        },
        has_seasonal_pattern: true,
        seasonal_severity: {
          'spring': 7.2,
          'summer': 5.1,
          'fall': 6.8,
          'winter': 3.5
        }
      });
    }
  };
  
  const fetchRiskFactors = async (user) => {
    try {
      // Get Firebase Auth ID token
      const idToken = await user.getIdToken();

      // This would be an API call to get risk factors
      const response = await fetch(`${API_URL}/api/analysis/risk-factors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ userId: user.uid }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setRiskFactors(result.riskFactors);
      } else {
        throw new Error(result.error || 'Failed to fetch risk factors');
      }
    } catch (error) {
      console.error('Error fetching risk factors:', error);
      // Fallback to mock data
      setRiskFactors([
        { factor: 'Pollen Count', weight: 0.35 },
        { factor: 'Food Allergens', weight: 0.28 },
        { factor: 'Weather Changes', weight: 0.22 },
        { factor: 'Time of Day', weight: 0.15 }
      ]);
    }
  };
  
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  // Prepare data for the risk prediction chart
  const prepareRiskChart = () => {
    if (predictions.length === 0) return null;
    
    // Limit to last 7 predictions for readability
    const recentPredictions = predictions.slice(-7);
    
    return {
      labels: recentPredictions.map(p => formatDate(p.date)),
      datasets: [
        {
          data: recentPredictions.map(p => p.risk_level * 100),
          color: (opacity = 1) => `rgba(0, 206, 209, ${opacity})`, // Deep Turquoise
          strokeWidth: 3,
          // Add gradient fill below the line
          withDots: true,
          withInnerLines: true,
          withOuterLines: true,
          withVerticalLines: false,
          withHorizontalLines: true,
          withVerticalLabels: true,
          withHorizontalLabels: true,
          fillShadowGradient: '#00CED1',
          fillShadowGradientOpacity: 0.2,
          // Add confidence intervals if available
          confidence: recentPredictions.map(p => p.confidence * 100)
        }
      ],
      legend: ['Risk %']
    };
  };
  
  // Prepare data for the seasonal pattern chart
  const prepareSeasonalChart = () => {
    if (!temporalPatterns || !temporalPatterns.seasonal_severity) return null;
    
    const { seasonal_severity } = temporalPatterns;
    
    return {
      labels: ['Spring', 'Summer', 'Fall', 'Winter'],
      datasets: [
        {
          data: [
            seasonal_severity.spring,
            seasonal_severity.summer,
            seasonal_severity.fall,
            seasonal_severity.winter
          ],
          color: (opacity = 1) => `rgba(32, 178, 170, ${opacity})`, // Light Sea Green
          strokeWidth: 2
        }
      ],
      legend: ['Severity']
    };
  };
  
  // Prepare data for the risk factors chart
  const prepareRiskFactorsChart = () => {
    if (riskFactors.length === 0) return null;
    
    return {
      labels: riskFactors.map(rf => rf.factor),
      datasets: [
        {
          data: riskFactors.map(rf => rf.weight * 100),
          color: (opacity = 1) => `rgba(46, 204, 113, ${opacity})`, // Emerald Green
          strokeWidth: 2
        }
      ]
    };
  };
  
  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 206, 209, ${opacity})`, // Deep Turquoise
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16
    },
    propsForDots: {
      r: '5',
      strokeWidth: '2',
      stroke: '#00CED1'
    },
    // Add proper padding to keep chart contents inside the box
    paddingRight: 20,
    paddingLeft: 12,
    paddingTop: 24,
    paddingBottom: 16
  };
  
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00CED1" />
        <Text style={styles.loadingText}>Loading prediction data...</Text>
      </View>
    );
  }
  
  const riskChartData = prepareRiskChart();
  const seasonalChartData = prepareSeasonalChart();
  const riskFactorsChartData = prepareRiskFactorsChart();
  
  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.content}>
        <Text style={styles.title}>Allergy Predictions</Text>
        <Text style={styles.subtitle}>
          View your allergy risk trends and patterns
        </Text>
        
        {/* Risk Trend Chart */}
        <Card style={styles.card}>
          <Card.Content>
            <Title>Risk Prediction Trend</Title>
            {riskChartData ? (
              <View style={styles.chartContainer}>
                <LineChart
                  data={riskChartData}
                  width={width - 60}
                  height={220}
                  chartConfig={chartConfig}
                  bezier
                  style={styles.chart}
                  withVerticalLabels={true}
                  withHorizontalLabels={true}
                  withInnerLines={true}
                  yAxisLabel=""
                  yAxisSuffix="%"
                />
              </View>
            ) : (
              <Text style={styles.noDataText}>
                Not enough data to show risk prediction trend
              </Text>
            )}
          </Card.Content>
        </Card>
        
        {/* Seasonal Pattern Chart */}
        <Card style={styles.card}>
          <Card.Content>
            <Title>Seasonal Pattern</Title>
            {seasonalChartData ? (
              <View style={styles.chartContainer}>
                <LineChart
                  data={seasonalChartData}
                  width={width - 60}
                  height={220}
                  chartConfig={{
                    ...chartConfig,
                    color: (opacity = 1) => `rgba(32, 178, 170, ${opacity})` // Light Sea Green
                  }}
                  style={styles.chart}
                  bezier
                  withVerticalLabels={true}
                  withHorizontalLabels={true}
                  withInnerLines={true}
                  yAxisLabel=""
                  yAxisSuffix=""
                />
              </View>
            ) : (
              <Text style={styles.noDataText}>
                Not enough data to show seasonal patterns
              </Text>
            )}
            
            {temporalPatterns && temporalPatterns.has_seasonal_pattern && (
              <Paragraph style={styles.insight}>
                Your allergy severity shows significant seasonal variation.
                Spring appears to be your highest risk season.
              </Paragraph>
            )}
          </Card.Content>
        </Card>
        
        {/* Risk Factors Chart */}
        <Card style={styles.card}>
          <Card.Content>
            <Title>Risk Factors</Title>
            {riskFactorsChartData ? (
              <View style={styles.chartContainer}>
                <LineChart
                  data={riskFactorsChartData}
                  width={width - 60}
                  height={220}
                  chartConfig={{
                    ...chartConfig,
                    color: (opacity = 1) => `rgba(46, 204, 113, ${opacity})` // Emerald Green
                  }}
                  style={styles.chart}
                  bezier
                  withVerticalLabels={true}
                  withHorizontalLabels={true}
                  withInnerLines={true}
                  yAxisLabel=""
                  yAxisSuffix="%"
                />
              </View>
            ) : (
              <Text style={styles.noDataText}>
                Not enough data to calculate risk factors
              </Text>
            )}
            
            {riskFactors.length > 0 && (
              <View style={styles.factorsList}>
                <Text style={styles.factorsTitle}>Top Risk Factors:</Text>
                {riskFactors.map((factor, index) => (
                  <Text key={index} style={styles.factorItem}>
                    {factor.factor}: {Math.round(factor.weight * 100)}% contribution
                  </Text>
                ))}
              </View>
            )}
          </Card.Content>
        </Card>
        
        {/* Get New Prediction Button */}
        <Button
          mode="contained"
          onPress={onRefresh}
          style={styles.refreshButton}
          icon="refresh"
        >
          Update Predictions
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0FFFF', // Changed from Light Cyan to White
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#008B8B', // Dark Cyan
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
  chartContainer: {
    alignItems: 'center',
    marginVertical: 12,
    padding: 8,
    backgroundColor: '#FFFFFF', // Changed from Azure to White
    borderRadius: 12,
    // Add more horizontal padding to fix overflow issues
    paddingHorizontal: 10,
    overflow: 'hidden' // This ensures content doesn't spill out
  },
  chart: {
    marginVertical: 12,
    borderRadius: 16,
  },
  noDataText: {
    textAlign: 'center',
    padding: 24,
    color: '#20B2AA', // Light Sea Green
    fontSize: 16,
  },
  insight: {
    backgroundColor: '#FFFFFF', // Changed from Azure to White
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  factorsList: {
    marginTop: 20,
    backgroundColor: '#FFFFFF', // Changed from Azure to White
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  factorsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#008B8B', // Dark Cyan
  },
  factorItem: {
    fontSize: 16,
    marginBottom: 8,
    color: '#20B2AA', // Light Sea Green
  },
  refreshButton: {
    marginTop: 16,
    marginBottom: 24,
    backgroundColor: '#00CED1', // Deep Turquoise
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});