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
import { collection, query, orderBy, limit, getDocs, doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore';

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
        console.log('PredictionScreen: No current user found');
        Alert.alert('Error', 'Please sign in to view predictions');
        return;
      }

      console.log('PredictionScreen: Loading data for user:', currentUser.uid);
      
      // Add timeout to prevent infinite loading
      const loadPromise = Promise.all([
        fetchPredictionHistory(currentUser),
        fetchAllergyHistory(currentUser),
        fetchTemporalPatterns(currentUser),
        fetchRiskFactors(currentUser),
      ]);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Loading timeout')), 30000)
      );
      
      await Promise.race([loadPromise, timeoutPromise]);
      console.log('PredictionScreen: Data loading completed');
    } catch (error) {
      console.error('PredictionScreen: Error loading prediction data:', error);
      if (error.message === 'Loading timeout') {
        Alert.alert('Loading Timeout', 'Data is taking too long to load. Please try refreshing.');
      } else {
        Alert.alert('Error', 'Failed to load prediction data');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const generateNewPrediction = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'Please sign in to generate predictions');
        return;
      }

      // Get user's actual data
      const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
      if (!userDoc.exists()) {
        Alert.alert('Error', 'User data not found');
        return;
      }

      const userData = userDoc.data();
      const reactions = userData.allergy_reactions || [];
      const allergens = userData.allergens || [];
      
      // Calculate risk based on user's actual data
      let riskLevel = 0.3; // Base risk
      let confidence = 0.7;
      const contributingFactors = [];

      // Factor in recent reactions
      if (reactions.length > 0) {
        const recentReactions = reactions.slice(-3); // Last 3 reactions
        const avgSeverity = recentReactions.reduce((sum, r) => sum + (r.severity || 5), 0) / recentReactions.length;
        riskLevel += (avgSeverity / 10) * 0.4; // Up to 40% based on recent severity
        contributingFactors.push(`Recent reaction severity: ${avgSeverity.toFixed(1)}/10`);
      }

      // Factor in number of allergens
      if (allergens.length > 0) {
        riskLevel += Math.min(allergens.length * 0.1, 0.3); // Up to 30% based on allergen count
        contributingFactors.push(`${allergens.length} known allergens`);
      }

      // Factor in reaction frequency
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const recentReactions = reactions.filter(r => {
        const reactionDate = r.timestamp ? r.timestamp.toDate() : new Date();
        return reactionDate > lastWeek;
      });
      
      if (recentReactions.length > 2) {
        riskLevel += 0.2; // High frequency increases risk
        contributingFactors.push(`High reaction frequency (${recentReactions.length} this week)`);
      }

      // Add environmental factors (mock for now, but could integrate with real environmental data)
      const environmentalRisk = Math.random() * 0.2; // 0-20% environmental risk
      riskLevel += environmentalRisk;
      contributingFactors.push('Current environmental conditions');

      // Cap risk level at 1.0
      riskLevel = Math.min(riskLevel, 1.0);

      // Calculate confidence based on data availability
      if (reactions.length > 5 && allergens.length > 0) {
        confidence = 0.9; // High confidence with good data
      } else if (reactions.length > 2) {
        confidence = 0.7; // Medium confidence
      } else {
        confidence = 0.5; // Low confidence with limited data
      }

      const newPrediction = {
        id: `pred_${Date.now()}`,
        risk_level: riskLevel,
        confidence: confidence,
        contributing_factors: contributingFactors,
        date: new Date(),
      };

      // Add to existing predictions
      setPredictions(prev => [...prev, newPrediction]);

      // Save prediction to user's document
      try {
        const userRef = doc(firestore, 'users', currentUser.uid);
        await setDoc(userRef, { 
          predictions: arrayUnion(newPrediction) 
        }, { merge: true });
      } catch (error) {
        console.log('Could not save prediction to Firebase:', error);
        // Continue anyway, prediction is still added to local state
      }

      Alert.alert(
        'New Prediction Generated',
        `Your allergy risk is ${Math.round(newPrediction.risk_level * 100)}% with ${Math.round(newPrediction.confidence * 100)}% confidence.\n\nBased on your ${reactions.length} recorded reactions and ${allergens.length} known allergens.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error generating prediction:', error);
      Alert.alert('Error', 'Failed to generate new prediction');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchPredictionHistory = async (user, retryCount = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds

    try {
      // Try to get predictions from user's document first
      const userDoc = await getDoc(doc(firestore, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const predictions = userData.predictions || [];
        
        if (predictions.length > 0) {
          const predictionData = predictions.map((pred, index) => ({
            id: `pred_${index}`,
            risk_level: pred.risk_level || 0.5,
            confidence: pred.confidence || 0.7,
            contributing_factors: pred.contributing_factors || ['Environmental factors'],
            date: pred.timestamp ? pred.timestamp.toDate() : new Date(),
          }));
          
          // Sort by date (oldest first for charts)
          predictionData.sort((a, b) => a.date - b.date);
          setPredictions(predictionData);
          return;
        }
      }

      // If no predictions found, create some mock data for demonstration
      // But only show mock data if user has very little real data
      const userDocFallback = await getDoc(doc(firestore, 'users', user.uid));
      if (userDocFallback.exists()) {
        const userData = userDocFallback.data();
        const reactions = userData.allergy_reactions || [];
        const allergens = userData.allergens || [];
        
        if (reactions.length < 2 && allergens.length === 0) {
          // Show mock data only for users with very little data
          const mockPredictions = [
            {
              id: 'mock_1',
              risk_level: 0.3,
              confidence: 0.8,
              contributing_factors: ['Low pollen count', 'Good air quality'],
              date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
            },
            {
              id: 'mock_2',
              risk_level: 0.6,
              confidence: 0.7,
              contributing_factors: ['Moderate pollen', 'Weather changes'],
              date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
            },
            {
              id: 'mock_3',
              risk_level: 0.4,
              confidence: 0.9,
              contributing_factors: ['Stable conditions'],
              date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
            },
            {
              id: 'mock_4',
              risk_level: 0.7,
              confidence: 0.6,
              contributing_factors: ['High pollen count', 'Windy conditions'],
              date: new Date(), // Today
            }
          ];
          
          setPredictions(mockPredictions);
        } else {
          // User has some data, show empty state with encouragement to generate predictions
          setPredictions([]);
        }
      } else {
        // No user document, show mock data
        const mockPredictions = [
          {
            id: 'mock_1',
            risk_level: 0.3,
            confidence: 0.8,
            contributing_factors: ['Low pollen count', 'Good air quality'],
            date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
          },
          {
            id: 'mock_2',
            risk_level: 0.6,
            confidence: 0.7,
            contributing_factors: ['Moderate pollen', 'Weather changes'],
            date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
          },
          {
            id: 'mock_3',
            risk_level: 0.4,
            confidence: 0.9,
            contributing_factors: ['Stable conditions'],
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          },
          {
            id: 'mock_4',
            risk_level: 0.7,
            confidence: 0.6,
            contributing_factors: ['High pollen count', 'Windy conditions'],
            date: new Date(), // Today
          }
        ];
        
        setPredictions(mockPredictions);
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
      
      // If all retries fail, use mock data
      console.log('Using fallback mock prediction data');
      const mockPredictions = [
        {
          id: 'fallback_1',
          risk_level: 0.5,
          confidence: 0.7,
          contributing_factors: ['Environmental factors'],
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'fallback_2',
          risk_level: 0.6,
          confidence: 0.8,
          contributing_factors: ['Weather changes'],
          date: new Date(),
        }
      ];
      setPredictions(mockPredictions);
    }
  };
  
  const fetchAllergyHistory = async (user, retryCount = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds

    try {
      const userDoc = await getDoc(doc(firestore, 'users', user.uid));
        
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Use allergy_reactions instead of severity_history
        const reactions = userData.allergy_reactions || [];
        
        // Convert reactions to severity history format
        const historyWithDates = reactions.map(reaction => ({
          severity: reaction.severity || 5,
          timestamp: reaction.timestamp,
          date: reaction.timestamp ? reaction.timestamp.toDate() : new Date(),
          symptoms: reaction.symptoms || [],
          notes: reaction.notes || ''
        }));
        
        historyWithDates.sort((a, b) => a.date - b.date);
        setAllergyHistory(historyWithDates);
      } else {
        // If no user data, create some mock allergy history
        const mockHistory = [
          {
            severity: 4,
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            symptoms: ['Sneezing', 'Runny nose'],
            notes: 'Mild reaction'
          },
          {
            severity: 6,
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            symptoms: ['Hives', 'Itching'],
            notes: 'Moderate reaction'
          },
          {
            severity: 3,
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            symptoms: ['Mild congestion'],
            notes: 'Very mild'
          }
        ];
        setAllergyHistory(mockHistory);
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
      // Get user's actual allergy reactions to analyze patterns
      const userDoc = await getDoc(doc(firestore, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const reactions = userData.allergy_reactions || [];
        
        if (reactions.length > 0) {
          // Analyze actual user data for patterns
          const dailyPattern = {};
          const monthlyPattern = {};
          const seasonalSeverity = { spring: 0, summer: 0, fall: 0, winter: 0 };
          const seasonalCounts = { spring: 0, summer: 0, fall: 0, winter: 0 };
          
          reactions.forEach(reaction => {
            const date = reaction.timestamp ? reaction.timestamp.toDate() : new Date();
            const hour = date.getHours();
            const month = date.getMonth() + 1;
            const severity = reaction.severity || 5;
            
            // Daily pattern (by hour)
            if (!dailyPattern[hour]) {
              dailyPattern[hour] = { total: 0, count: 0 };
            }
            dailyPattern[hour].total += severity;
            dailyPattern[hour].count += 1;
            
            // Monthly pattern
            if (!monthlyPattern[month]) {
              monthlyPattern[month] = { total: 0, count: 0 };
            }
            monthlyPattern[month].total += severity;
            monthlyPattern[month].count += 1;
            
            // Seasonal pattern
            let season;
            if (month >= 3 && month <= 5) season = 'spring';
            else if (month >= 6 && month <= 8) season = 'summer';
            else if (month >= 9 && month <= 11) season = 'fall';
            else season = 'winter';
            
            seasonalSeverity[season] += severity;
            seasonalCounts[season] += 1;
          });
          
          // Calculate averages
          const dailyAverages = {};
          Object.keys(dailyPattern).forEach(hour => {
            dailyAverages[hour] = dailyPattern[hour].total / dailyPattern[hour].count;
          });
          
          const monthlyAverages = {};
          Object.keys(monthlyPattern).forEach(month => {
            monthlyAverages[month] = monthlyPattern[month].total / monthlyPattern[month].count;
          });
          
          Object.keys(seasonalSeverity).forEach(season => {
            if (seasonalCounts[season] > 0) {
              seasonalSeverity[season] = seasonalSeverity[season] / seasonalCounts[season];
            }
          });
          
          // Check for seasonal pattern (variance > 1.5)
          const seasonalValues = Object.values(seasonalSeverity).filter(v => v > 0);
          const hasSeasonalPattern = seasonalValues.length > 1 && 
            Math.max(...seasonalValues) - Math.min(...seasonalValues) > 1.5;
          
          setTemporalPatterns({
            daily_pattern: dailyAverages,
            monthly_pattern: monthlyAverages,
            has_seasonal_pattern: hasSeasonalPattern,
            seasonal_severity: seasonalSeverity
          });
          return;
        }
      }
      
      // Fallback to mock data if no user data
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
      // Analyze user's actual data to determine risk factors
      const userDoc = await getDoc(doc(firestore, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const reactions = userData.allergy_reactions || [];
        const allergens = userData.allergens || [];
        
        const riskFactors = [];
        
        // Analyze reaction patterns
        if (reactions.length > 0) {
          // Factor 1: Reaction frequency
          const now = new Date();
          const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          const recentReactions = reactions.filter(r => {
            const reactionDate = r.timestamp ? r.timestamp.toDate() : new Date();
            return reactionDate > lastMonth;
          });
          
          if (recentReactions.length > 0) {
            riskFactors.push({
              factor: 'Recent Reaction Frequency',
              weight: Math.min(recentReactions.length / 10, 0.4) // Up to 40% based on frequency
            });
          }
          
          // Factor 2: Average severity
          const avgSeverity = reactions.reduce((sum, r) => sum + (r.severity || 5), 0) / reactions.length;
          riskFactors.push({
            factor: 'Average Reaction Severity',
            weight: (avgSeverity / 10) * 0.3 // Up to 30% based on severity
          });
          
          // Factor 3: Symptom diversity
          const allSymptoms = reactions.flatMap(r => r.symptoms || []);
          const uniqueSymptoms = [...new Set(allSymptoms)];
          riskFactors.push({
            factor: 'Symptom Diversity',
            weight: Math.min(uniqueSymptoms.length / 20, 0.2) // Up to 20% based on symptom variety
          });
        }
        
        // Factor 4: Number of known allergens
        if (allergens.length > 0) {
          riskFactors.push({
            factor: 'Known Allergen Count',
            weight: Math.min(allergens.length / 15, 0.3) // Up to 30% based on allergen count
          });
        }
        
        // Factor 5: Environmental factors (mock for now)
        riskFactors.push({
          factor: 'Environmental Conditions',
          weight: 0.2 // 20% environmental risk
        });
        
        // Normalize weights to sum to 1.0
        const totalWeight = riskFactors.reduce((sum, rf) => sum + rf.weight, 0);
        if (totalWeight > 0) {
          riskFactors.forEach(rf => {
            rf.weight = rf.weight / totalWeight;
          });
        }
        
        // Sort by weight (highest first)
        riskFactors.sort((a, b) => b.weight - a.weight);
        
        setRiskFactors(riskFactors);
        return;
      }
      
      // Fallback to mock data if no user data
      setRiskFactors([
        { factor: 'Pollen Count', weight: 0.35 },
        { factor: 'Food Allergens', weight: 0.28 },
        { factor: 'Weather Changes', weight: 0.22 },
        { factor: 'Time of Day', weight: 0.15 }
      ]);
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
              <View style={styles.noDataContainer}>
                <Text style={styles.noDataText}>
                  No predictions yet
                </Text>
                <Text style={styles.noDataSubtext}>
                  Generate your first prediction to see your allergy risk trends
                </Text>
              </View>
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
          onPress={generateNewPrediction}
          style={styles.refreshButton}
          icon="plus"
        >
          Generate New Prediction
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
  noDataContainer: {
    alignItems: 'center',
    padding: 24,
  },
  noDataText: {
    textAlign: 'center',
    color: '#20B2AA', // Light Sea Green
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  noDataSubtext: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
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