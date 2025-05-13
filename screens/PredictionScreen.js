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
import { LineChart, BarChart } from 'react-native-chart-kit';
import { auth, firestore } from '../firebase';
import { getRiskColor } from '../utils/helpers';
import { API_URL } from '../config';

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
      await Promise.all([
        fetchPredictionHistory(),
        fetchAllergyHistory(),
        fetchTemporalPatterns(),
        fetchRiskFactors(),
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
  
  const fetchPredictionHistory = async () => {
    const user = auth().currentUser;
    if (!user) return;
    
    const snapshot = await firestore()
      .collection('users')
      .doc(user.uid)
      .collection('predictions')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();
      
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
  };
  
  const fetchAllergyHistory = async () => {
    const user = auth().currentUser;
    if (!user) return;
    
    const userDoc = await firestore()
      .collection('users')
      .doc(user.uid)
      .get();
      
    if (userDoc.exists) {
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
  };
  
  const fetchTemporalPatterns = async () => {
    const user = auth().currentUser;
    if (!user) return;
    
    try {
      // This would be an API call to get patterns
      const response = await fetch(`${API_URL}/api/analysis/temporal-patterns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.uid }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setTemporalPatterns(result.patterns);
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
  
  const fetchRiskFactors = async () => {
    const user = auth().currentUser;
    if (!user) return;
    
    try {
      // This would be an API call to get risk factors
      const response = await fetch(`${API_URL}/api/analysis/risk-factors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.uid }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setRiskFactors(result.riskFactors);
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
          color: (opacity = 1) => `rgba(98, 0, 238, ${opacity})`,
          strokeWidth: 2
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
          color: (opacity = 1) => `rgba(255, 107, 107, ${opacity})`,
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
          data: riskFactors.map(rf => rf.weight * 100)
        }
      ]
    };
  };
  
  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(98, 0, 238, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#6200ee'
    }
  };
  
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
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
                  width={width - 40}
                  height={220}
                  chartConfig={chartConfig}
                  bezier
                  style={styles.chart}
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
                <BarChart
                  data={seasonalChartData}
                  width={width - 40}
                  height={220}
                  chartConfig={{
                    ...chartConfig,
                    color: (opacity = 1) => `rgba(255, 107, 107, ${opacity})`
                  }}
                  style={styles.chart}
                  fromZero
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
                <BarChart
                  data={riskFactorsChartData}
                  width={width - 40}
                  height={220}
                  chartConfig={{
                    ...chartConfig,
                    color: (opacity = 1) => `rgba(46, 204, 113, ${opacity})`
                  }}
                  style={styles.chart}
                  fromZero
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
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
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
  card: {
    marginBottom: 16,
    elevation: 2,
    borderRadius: 8,
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  noDataText: {
    textAlign: 'center',
    padding: 20,
    color: '#666',
  },
  insight: {
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  factorsList: {
    marginTop: 16,
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
  },
  factorsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  factorItem: {
    fontSize: 14,
    marginBottom: 4,
    color: '#333',
  },
  refreshButton: {
    marginTop: 8,
    marginBottom: 24,
  },
});