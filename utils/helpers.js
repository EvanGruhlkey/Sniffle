// Helper functions for the application
import * as Location from 'expo-location';
import { API_URL } from '../config';

// Get color for risk indicator based on risk level
export const getRiskColor = (riskLevel) => {
    if (riskLevel < 0.3) {
      return '#4caf50';  // Green for low risk
    } else if (riskLevel < 0.7) {
      return '#ff9800';  // Orange for medium risk
    } else {
      return '#f44336';  // Red for high risk
    }
  };

// Calculate overall allergy risk from environmental conditions and user data
// Enhanced Allergy Risk Calculator with improved accuracy and scientific modeling
export const calculateAllergyRisk = (environmentalData, userData = null) => {
  if (!environmentalData) {
    return {
      level: 'unknown',
      score: 0,
      description: 'Unable to assess - insufficient data',
      recommendations: ['Check back when environmental data is available'],
      confidence: 0
    };
  }

  const riskFactors = {
    environmental: 0,
    personal: 0,
    temporal: 0,
    synergistic: 0
  };

  const detailedFactors = [];
  const personalFactors = [];
  let confidence = 0.7; // Base confidence without user data

  // === ENVIRONMENTAL RISK ANALYSIS (40% weight) ===
  
  // Pollen Risk Analysis (Enhanced with specificity)
  const pollenData = analyzePollenRisk(environmentalData);
  riskFactors.environmental += pollenData.score;
  detailedFactors.push(...pollenData.factors);
  
  // Air Quality Analysis (Comprehensive AQI interpretation)
  const airQualityData = analyzeAirQuality(environmentalData);
  riskFactors.environmental += airQualityData.score;
  detailedFactors.push(...airQualityData.factors);
  
  // Weather Pattern Analysis (More sophisticated)
  const weatherData = analyzeWeatherImpact(environmentalData);
  riskFactors.environmental += weatherData.score;
  detailedFactors.push(...weatherData.factors);

  // === PERSONAL RISK ANALYSIS (50% weight when available) ===
  if (userData) {
    confidence = 0.95; // Higher confidence with user data
    
    // Allergy Profile Analysis
    const allergyProfile = analyzeAllergyProfile(userData, environmentalData);
    riskFactors.personal += allergyProfile.score;
    personalFactors.push(...allergyProfile.factors);
    
    // Historical Pattern Analysis
    const historicalData = analyzeHistoricalPatterns(userData, environmentalData);
    riskFactors.personal += historicalData.score;
    personalFactors.push(...historicalData.factors);
    
    // Recent Exposure Analysis
    const exposureData = analyzeRecentExposure(userData);
    riskFactors.personal += exposureData.score;
    personalFactors.push(...exposureData.factors);
    
    // Medication Impact Analysis
    const medicationData = analyzeMedicationImpact(userData);
    riskFactors.personal += medicationData.score;
    personalFactors.push(...medicationData.factors);
  }

  // === TEMPORAL RISK ANALYSIS (10% weight) ===
  const temporalData = analyzeTemporalFactors(environmentalData, userData);
  riskFactors.temporal += temporalData.score;
  detailedFactors.push(...temporalData.factors);

  // === SYNERGISTIC EFFECTS ANALYSIS ===
  const synergisticData = analyzeSynergisticEffects(environmentalData, userData, riskFactors);
  riskFactors.synergistic = synergisticData.score;
  if (synergisticData.factors.length > 0) {
    detailedFactors.push(...synergisticData.factors);
  }

  // === RISK SCORE CALCULATION ===
  const weights = userData ? 
    { environmental: 0.35, personal: 0.45, temporal: 0.10, synergistic: 0.10 } :
    { environmental: 0.70, personal: 0.0, temporal: 0.20, synergistic: 0.10 };

  const totalScore = Math.min(
    (riskFactors.environmental * weights.environmental +
     riskFactors.personal * weights.personal +
     riskFactors.temporal * weights.temporal +
     riskFactors.synergistic * weights.synergistic), 100
  );

  // === RISK LEVEL DETERMINATION ===
  const riskLevel = determineRiskLevel(totalScore, confidence);
  
  // === GENERATE RECOMMENDATIONS ===
  const allFactors = [...detailedFactors, ...personalFactors];
  const recommendations = generateEnhancedRecommendations(riskLevel.level, allFactors, userData, environmentalData);

  return {
    level: riskLevel.level,
    score: Math.round(totalScore),
    description: riskLevel.description,
    color: riskLevel.color,
    factors: allFactors.length > 0 ? allFactors : ['Environmental conditions assessed'],
    recommendations,
    personalizedScore: userData ? true : false,
    confidence: Math.round(confidence * 100),
    breakdown: {
      environmental: Math.round(riskFactors.environmental * weights.environmental),
      personal: Math.round(riskFactors.personal * weights.personal),
      temporal: Math.round(riskFactors.temporal * weights.temporal),
      synergistic: Math.round(riskFactors.synergistic * weights.synergistic)
    }
  };
};

// === ENHANCED ANALYSIS FUNCTIONS ===

function analyzePollenRisk(environmentalData) {
  const factors = [];
  let score = 0;
  
  const pollenRisk = environmentalData.pollen_risk?.toLowerCase();
  const pollenCount = environmentalData.pollen_count || 0;
  const pollenTypes = environmentalData.pollen_types || [];
  
  // Base pollen risk
  switch (pollenRisk) {
    case 'very_low':
      score += 2;
      break;
    case 'low':
      score += 8;
      factors.push('Low pollen levels detected');
      break;
    case 'moderate':
      score += 20;
      factors.push('Moderate pollen levels present');
      break;
    case 'high':
      score += 35;
      factors.push('High pollen concentration');
      break;
    case 'very_high':
      score += 50;
      factors.push('Very high pollen levels - peak allergen exposure');
      break;
  }
  
  // Specific pollen type analysis
  if (pollenTypes.length > 0) {
    const highRiskTypes = ['ragweed', 'birch', 'oak', 'grass'];
    const detectedHighRisk = pollenTypes.filter(type => 
      highRiskTypes.some(risk => type.toLowerCase().includes(risk))
    );
    
    if (detectedHighRisk.length > 0) {
      score += detectedHighRisk.length * 5;
      factors.push(`High-allergenicity pollen detected: ${detectedHighRisk.join(', ')}`);
    }
  }
  
  // Pollen count specific analysis
  if (pollenCount > 0) {
    if (pollenCount > 1000) {
      score += 15;
      factors.push(`Very high pollen count: ${pollenCount} grains/m³`);
    } else if (pollenCount > 500) {
      score += 8;
      factors.push(`High pollen count: ${pollenCount} grains/m³`);
    }
  }
  
  return { score: Math.min(score, 50), factors };
}

function analyzeAirQuality(environmentalData) {
  const factors = [];
  let score = 0;
  
  const aqi = environmentalData.air_quality || environmentalData.aqi;
  const pm25 = environmentalData.pm25;
  const pm10 = environmentalData.pm10;
  const ozone = environmentalData.ozone;
  const no2 = environmentalData.no2;
  
  // AQI-based scoring (more granular)
  if (aqi !== undefined) {
    if (aqi <= 50) {
      score += 0;
    } else if (aqi <= 100) {
      score += 5;
      factors.push('Moderate air quality may affect sensitive individuals');
    } else if (aqi <= 150) {
      score += 15;
      factors.push('Unhealthy air quality for sensitive groups');
    } else if (aqi <= 200) {
      score += 25;
      factors.push('Unhealthy air quality - respiratory irritation likely');
    } else {
      score += 35;
      factors.push('Very unhealthy air quality - avoid outdoor activities');
    }
  }
  
  // Specific pollutant analysis
  if (pm25 !== undefined) {
    if (pm25 > 55) {
      score += 10;
      factors.push(`High PM2.5 levels (${pm25} μg/m³) - respiratory irritant`);
    }
  }
  
  if (ozone !== undefined && ozone > 140) {
    score += 8;
    factors.push('Elevated ozone levels - may trigger respiratory symptoms');
  }
  
  return { score: Math.min(score, 40), factors };
}

function analyzeWeatherImpact(environmentalData) {
  const factors = [];
  let score = 0;
  
  const weather = environmentalData.weather_condition?.toLowerCase() || '';
  const humidity = environmentalData.humidity || 0;
  const windSpeed = environmentalData.wind_speed || 0;
  const temperature = environmentalData.temperature || 20;
  const pressure = environmentalData.barometric_pressure;
  
  // Weather condition analysis
  if (weather.includes('thunderstorm') || weather.includes('storm')) {
    score -= 5; // Storms wash out allergens
    factors.push('Thunderstorms help clear airborne allergens');
  } else if (weather.includes('rain')) {
    score -= 3;
    factors.push('Rain reduces pollen and dust particles');
  } else if (weather.includes('wind') && windSpeed > 15) {
    score += 8;
    factors.push('Strong winds dispersing allergens widely');
  } else if (windSpeed > 8) {
    score += 4;
    factors.push('Moderate winds spreading pollen');
  }
  
  // Humidity analysis (more nuanced)
  if (humidity > 80) {
    score += 6;
    factors.push('Very high humidity promoting mold growth');
  } else if (humidity > 60) {
    score += 3;
    factors.push('Elevated humidity may increase mold spores');
  } else if (humidity < 30) {
    score += 2;
    factors.push('Low humidity may increase dust and irritants');
  }
  
  // Temperature analysis
  if (temperature > 25 && humidity > 50) {
    score += 3;
    factors.push('Warm, humid conditions favor allergen production');
  }
  
  // Barometric pressure analysis
  if (pressure !== undefined) {
    if (pressure < 1000) {
      score += 2;
      factors.push('Low pressure system may increase sinus pressure');
    }
  }
  
  return { score: Math.min(score, 20), factors };
}

function analyzeAllergyProfile(userData, environmentalData) {
  const factors = [];
  let score = 0;
  
  const userAllergens = userData.allergens || [];
  const severity = userData.allergy_severity || {};
  const pollenRisk = environmentalData.pollen_risk?.toLowerCase();
  
  if (userAllergens.length === 0) return { score, factors };
  
  // Cross-reference user allergens with environmental conditions
  for (const allergen of userAllergens) {
    const allergenLower = allergen.toLowerCase();
    const severityLevel = severity[allergen] || 'moderate';
    const multiplier = severityLevel === 'severe' ? 1.5 : severityLevel === 'mild' ? 0.7 : 1.0;
    
    // Pollen allergies
    if (allergenLower.includes('pollen') || allergenLower.includes('grass') || 
        allergenLower.includes('tree') || allergenLower.includes('weed') || 
        allergenLower.includes('ragweed') || allergenLower.includes('birch')) {
      
      if (pollenRisk === 'very_high') {
        score += 20 * multiplier;
        factors.push(`Very high ${allergen} pollen matches your severe allergy`);
      } else if (pollenRisk === 'high') {
        score += 15 * multiplier;
        factors.push(`High ${allergen} levels detected - matches your allergy profile`);
      } else if (pollenRisk === 'moderate') {
        score += 8 * multiplier;
        factors.push(`Moderate ${allergen} levels may trigger symptoms`);
      }
    }
    
    // Dust and mold allergies
    if (allergenLower.includes('dust') || allergenLower.includes('mold') || 
        allergenLower.includes('mildew')) {
      const aqi = environmentalData.air_quality || 0;
      const humidity = environmentalData.humidity || 0;
      
      if (aqi >= 3) {
        score += 10 * multiplier;
        factors.push(`Poor air quality affects your ${allergen} sensitivity`);
      }
      
      if (humidity > 70) {
        score += 8 * multiplier;
        factors.push(`High humidity promotes ${allergen} growth`);
      }
    }
    
    // Pet allergies with seasonal considerations
    if (allergenLower.includes('pet') || allergenLower.includes('cat') || 
        allergenLower.includes('dog') || allergenLower.includes('dander')) {
      // Indoor air quality affects pet allergen concentration
      if (environmentalData.air_quality >= 3) {
        score += 5 * multiplier;
        factors.push('Poor outdoor air may increase indoor pet allergen exposure');
      }
    }
  }
  
  return { score: Math.min(score, 40), factors };
}

function analyzeHistoricalPatterns(userData, environmentalData) {
  const factors = [];
  let score = 0;
  
  const reactions = userData.allergy_reactions || [];
  const currentMonth = new Date().getMonth();
  const currentWeather = environmentalData.weather_condition?.toLowerCase() || '';
  
  // Analyze seasonal patterns
  const seasonalReactions = reactions.filter(reaction => {
    const reactionDate = reaction.timestamp?.toDate?.() || new Date(reaction.timestamp);
    return reactionDate.getMonth() === currentMonth;
  });
  
  if (seasonalReactions.length > 0) {
    const avgSeverity = seasonalReactions.reduce((sum, r) => sum + (r.severity || 3), 0) / seasonalReactions.length;
    score += Math.min(seasonalReactions.length * 3 + avgSeverity * 2, 15);
    factors.push(`Historical pattern: ${seasonalReactions.length} reactions in similar conditions`);
  }
  
  // Weather pattern analysis
  const weatherReactions = reactions.filter(reaction => {
    const reactionWeather = reaction.weather_condition?.toLowerCase() || '';
    return reactionWeather.includes(currentWeather.split(' ')[0]);
  });
  
  if (weatherReactions.length > 2) {
    score += 8;
    factors.push(`Weather pattern match: increased risk in ${currentWeather} conditions`);
  }
  
  return { score: Math.min(score, 20), factors };
}

function analyzeRecentExposure(userData) {
  const factors = [];
  let score = 0;
  
  // Recent reactions (past 7 days)
  const recentReactions = userData.allergy_reactions?.filter(reaction => {
    const reactionDate = reaction.timestamp?.toDate?.() || new Date(reaction.timestamp);
    const daysSince = (new Date() - reactionDate) / (1000 * 60 * 60 * 24);
    return daysSince <= 7;
  }) || [];
  
  if (recentReactions.length > 0) {
    const severityBonus = recentReactions.reduce((sum, r) => sum + (r.severity || 3), 0);
    score += Math.min(recentReactions.length * 4 + severityBonus, 20);
    factors.push(`${recentReactions.length} recent reaction${recentReactions.length > 1 ? 's' : ''} increase sensitivity`);
  }
  
  // Recent food exposure
  const recentFoodLogs = userData.food_logs?.slice(-2) || [];
  const userAllergens = userData.allergens || [];
  const foodAllergens = userAllergens.filter(a => 
    !a.toLowerCase().includes('pollen') && 
    !a.toLowerCase().includes('dust') && 
    !a.toLowerCase().includes('mold')
  );
  
  if (recentFoodLogs.length > 0 && foodAllergens.length > 0) {
    const recentFoods = recentFoodLogs.flatMap(log => log.items || []);
    
    for (const allergen of foodAllergens) {
      const allergenWords = allergen.toLowerCase().split(' ');
      const foundExposure = recentFoods.some(food => 
        allergenWords.some(word => food.toLowerCase().includes(word)) ||
        food.toLowerCase().includes(allergen.toLowerCase())
      );
      
      if (foundExposure) {
        score += 8;
        factors.push(`Recent ${allergen} consumption may heighten overall sensitivity`);
        break;
      }
    }
  }
  
  return { score: Math.min(score, 25), factors };
}

function analyzeMedicationImpact(userData) {
  const factors = [];
  let score = 0;
  
  const medications = userData.medications || [];
  const recentMedication = userData.recent_medication_taken || false;
  
  // Check for allergy medications
  const allergyMeds = medications.filter(med => 
    med.type?.toLowerCase().includes('antihistamine') ||
    med.name?.toLowerCase().includes('claritin') ||
    med.name?.toLowerCase().includes('zyrtec') ||
    med.name?.toLowerCase().includes('allegra') ||
    med.name?.toLowerCase().includes('benadryl') ||
    med.type?.toLowerCase().includes('steroid')
  );
  
  if (allergyMeds.length > 0 && recentMedication) {
    score -= 10; // Medications reduce risk
    factors.push('Current allergy medications provide protection');
  } else if (allergyMeds.length > 0 && !recentMedication) {
    score += 5; // Missing medication increases risk
    factors.push('Allergy medication not taken recently - increased vulnerability');
  }
  
  // Check for medications that might increase sensitivity
  const sensitizingMeds = medications.filter(med =>
    med.type?.toLowerCase().includes('ace inhibitor') ||
    med.name?.toLowerCase().includes('aspirin')
  );
  
  if (sensitizingMeds.length > 0) {
    score += 3;
    factors.push('Some medications may increase allergic sensitivity');
  }
  
  return { score: Math.max(-10, Math.min(score, 10)), factors };
}

function analyzeTemporalFactors(environmentalData, userData) {
  const factors = [];
  let score = 0;
  
  const currentHour = new Date().getHours();
  const currentDay = new Date().getDay();
  const currentMonth = new Date().getMonth();
  
  // Time of day factors
  if (currentHour >= 6 && currentHour <= 10) {
    score += 3;
    factors.push('Morning hours show peak pollen release');
  } else if (currentHour >= 17 && currentHour <= 20) {
    score += 2;
    factors.push('Evening pollen descent increases ground-level exposure');
  }
  
  // Seasonal factors
  const highPollenMonths = [2, 3, 4, 8, 9]; // March, April, May, September, October
  if (highPollenMonths.includes(currentMonth)) {
    score += 4;
    factors.push('Peak allergy season increases baseline risk');
  }
  
  // Weekend vs weekday (if user has activity patterns)
  if (userData?.activity_patterns) {
    const isWeekend = currentDay === 0 || currentDay === 6;
    const outdoorActivity = userData.activity_patterns[isWeekend ? 'weekend' : 'weekday']?.outdoor_time || 0;
    
    if (outdoorActivity > 4) {
      score += 5;
      factors.push('High outdoor activity increases allergen exposure');
    }
  }
  
  return { score: Math.min(score, 15), factors };
}

function analyzeSynergisticEffects(environmentalData, userData, riskFactors) {
  const factors = [];
  let score = 0;
  
  const totalEnvironmentalRisk = riskFactors.environmental;
  const totalPersonalRisk = riskFactors.personal;
  
  // High combined risk amplification
  if (totalEnvironmentalRisk > 30 && totalPersonalRisk > 20) {
    score += 8;
    factors.push('High environmental and personal risk factors compound each other');
  }
  
  // Multiple allergen exposure
  if (userData?.allergens?.length > 3 && environmentalData.pollen_risk === 'high') {
    score += 5;
    factors.push('Multiple allergen sensitivities increase overall reactivity');
  }
  
  // Air quality and pollen combination
  const aqi = environmentalData.air_quality || 0;
  const pollenRisk = environmentalData.pollen_risk?.toLowerCase();
  
  if (aqi >= 3 && (pollenRisk === 'high' || pollenRisk === 'very_high')) {
    score += 6;
    factors.push('Poor air quality traps and concentrates pollen particles');
  }
  
  // Weather and allergen combination
  const humidity = environmentalData.humidity || 0;
  const windSpeed = environmentalData.wind_speed || 0;
  
  if (humidity > 70 && windSpeed > 5 && pollenRisk !== 'low') {
    score += 4;
    factors.push('Humid, windy conditions maximize allergen dispersal and mold growth');
  }
  
  return { score: Math.min(score, 15), factors };
}

function determineRiskLevel(score, confidence) {
  // Adjust thresholds based on confidence
  const confidenceAdjustment = confidence < 0.8 ? 0.9 : 1.0;
  const adjustedScore = score * confidenceAdjustment;
  
  if (adjustedScore <= 15) {
    return {
      level: 'low',
      description: 'Low Risk',
      color: '#4caf50'
    };
  } else if (adjustedScore <= 35) {
    return {
      level: 'moderate',
      description: 'Moderate Risk',
      color: '#ff9800'
    };
  } else if (adjustedScore <= 60) {
    return {
      level: 'high',
      description: 'High Risk',
      color: '#f44336'
    };
  } else {
    return {
      level: 'very_high',
      description: 'Very High Risk',
      color: '#d32f2f'
    };
  }
}

function generateEnhancedRecommendations(level, factors, userData, environmentalData) {
  const recommendations = [];
  const hasPersonalData = userData ? true : false;
  
  // Base recommendations by risk level
  switch (level) {
    case 'low':
      recommendations.push('Enjoy outdoor activities with minimal precautions');
      if (hasPersonalData && userData.allergens?.length > 0) {
        recommendations.push('Keep rescue medication handy as a precaution');
      }
      break;
      
    case 'moderate':
      recommendations.push('Consider limiting outdoor time during peak hours (6-10 AM)');
      recommendations.push('Close windows and use air conditioning when possible');
      if (hasPersonalData) {
        recommendations.push('Take preventive allergy medication as prescribed');
      }
      break;
      
    case 'high':
      recommendations.push('Limit outdoor activities, especially during morning hours');
      recommendations.push('Keep windows closed and use HEPA air filters indoors');
      recommendations.push('Shower and change clothes after being outdoors');
      if (hasPersonalData) {
        recommendations.push('Consider taking allergy medication before exposure');
        recommendations.push('Have rescue medication readily available');
      }
      break;
      
    case 'very_high':
      recommendations.push('Avoid outdoor activities if possible');
      recommendations.push('Stay indoors with air purification systems running');
      recommendations.push('If you must go out, wear a pollen-filtering mask');
      if (hasPersonalData) {
        recommendations.push('Take all prescribed allergy medications');
        recommendations.push('Consider consulting your allergist for additional protection');
      }
      break;
  }
  
  // Specific recommendations based on factors
  if (factors.some(f => f.includes('pollen'))) {
    recommendations.push('Check pollen forecasts before planning outdoor activities');
  }
  
  if (factors.some(f => f.includes('air quality'))) {
    recommendations.push('Use air quality apps to monitor conditions throughout the day');
  }
  
  if (factors.some(f => f.includes('humidity') || f.includes('mold'))) {
    recommendations.push('Use dehumidifiers to keep indoor humidity below 50%');
  }
  
  if (factors.some(f => f.includes('wind'))) {
    recommendations.push('Avoid outdoor exercise on windy days');
  }
  
  // Personalized recommendations
  if (hasPersonalData && userData.recent_medication_taken === false) {
    recommendations.push('Consider taking your allergy medication as prescribed');
  }
  
  return [...new Set(recommendations)]; // Remove duplicates
}

// Generate personalized recommendations based on risk level
const generateAllergyRecommendations = (riskLevel, factors, userData = null) => {
  const recommendations = [];

  // Base recommendations by risk level
  switch (riskLevel) {
    case 'low':
      recommendations.push('Great day for outdoor activities!');
      recommendations.push('Windows can stay open for fresh air');
      break;
    
    case 'moderate':
      recommendations.push('Take allergy medication if needed');
      recommendations.push('Consider limiting time outdoors during peak hours (10am-4pm)');
      if (factors.some(f => f.includes('pollen'))) {
        recommendations.push('Shower after spending time outside');
      }
      break;
    
    case 'high':
      recommendations.push('Take allergy medication before going outside');
      recommendations.push('Keep windows closed and use air conditioning');
      recommendations.push('Avoid outdoor exercise during peak pollen hours');
      recommendations.push('Wear sunglasses to protect eyes from pollen');
      break;
    
    case 'very_high':
      recommendations.push('Stay indoors if possible');
      recommendations.push('Take prescribed allergy medications');
      recommendations.push('Use air purifiers indoors');
      recommendations.push('Avoid hanging laundry outside');
      break;
  }

  // Environmental-specific recommendations
  if (factors.some(f => f.includes('air quality'))) {
    recommendations.push('Consider wearing a mask if you must go outside');
  }
  
  if (factors.some(f => f.includes('humidity'))) {
    recommendations.push('Use a dehumidifier to reduce indoor mold');
  }

  // Personalized recommendations based on user data
  if (userData) {
    const userAllergens = userData.allergens || [];
    
    // Food allergy recommendations
    if (factors.some(f => f.includes('consumption'))) {
      recommendations.push('Monitor for delayed food allergy reactions');
      recommendations.push('Keep your rescue medication readily available');
    }

    // Recent reaction recommendations
    if (factors.some(f => f.includes('recent reaction'))) {
      recommendations.push('Be extra cautious - your sensitivity may be heightened');
      recommendations.push('Consider consulting your allergist about recent reactions');
    }

    // Specific allergen recommendations
    if (userAllergens.some(a => a.toLowerCase().includes('dust'))) {
      recommendations.push('Use HEPA air filters and vacuum regularly');
    }
    
    if (userAllergens.some(a => a.toLowerCase().includes('pet'))) {
      recommendations.push('Wash hands after contact with animals');
    }

    // Medication reminders for high-risk users
    if (riskLevel === 'high' || riskLevel === 'very_high') {
      recommendations.push('Carry your emergency medication (EpiPen) if prescribed');
    }
  }

  return recommendations.slice(0, 4); // Limit to top 4 recommendations
};

// Get user's current location with city name
export const getCurrentLocation = async () => {
  try {
    console.log('Getting user location...');
    
    // Add timeout for location request
    const locationPromise = async () => {
      // Request permission to access location
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission to access location was denied');
        // Return default location (e.g., New York City)
        return {
          latitude: 40.7128,
          longitude: -74.0060,
          city: 'New York',
          region: 'NY'
        };
      }

      // Get current position with timeout
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
        timeout: 2000,
        maximumAge: 30000
      });
      console.log('Got user location:', location.coords.latitude, location.coords.longitude);
      
      // Get city name using reverse geocoding
      let cityInfo = { city: 'Unknown', region: '' };
      try {
        const geocodeResult = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
        
        if (geocodeResult && geocodeResult.length > 0) {
          const place = geocodeResult[0];
          cityInfo = {
            city: place.city || place.subregion || 'Unknown',
            region: place.region || place.isoCountryCode || ''
          };
          console.log('Got city info:', cityInfo);
        }
      } catch (geoError) {
        console.log('Could not get city name:', geoError);
      }
      
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        ...cityInfo
      };
    };

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Location timeout')), 3000)
    );

    return await Promise.race([locationPromise(), timeoutPromise]);
  } catch (error) {
    console.error('Error getting location:', error);
    console.log('Using default location (NYC)');
    // Return default location
    return {
      latitude: 40.7128,
      longitude: -74.0060,
      city: 'New York',
      region: 'NY'
    };
  }
};
  
// Fetch real environmental data from our backend API with retry logic
export const fetchEnvironmentalData = async (retryCount = 0) => {
  const MAX_RETRIES = 3;
  const TIMEOUT_MS = 12000; // Increased timeout to 12 seconds
  const RETRY_DELAY = 2000; // 2 second delay between retries
  
  try {
    console.log(`Fetching environmental data (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
    
    // Get user's current location
    const location = await getCurrentLocation();
    console.log('📍 Location obtained:', location);
    
    // Fetch environmental data from our backend with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('Request timeout - aborting');
      controller.abort();
    }, TIMEOUT_MS);
    
    const requestPayload = {
      latitude: location.latitude,
      longitude: location.longitude
    };
    console.log('🌐 Sending request to backend with payload:', requestPayload);
    
    const response = await fetch(`${API_URL}/api/environmental/current`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      const envData = result.data;
      console.log('Successfully fetched environmental data from backend');
      
      // Check if we got real data from the APIs
      if (!envData.weather || !envData.air_quality) {
        console.log('Backend returned null data - API key issues or API failures');
        throw new Error('Backend APIs failed - check OpenWeather API key and logs');
      }
      
      // Transform the data to match the expected format
      return {
        pollen_level: envData.pollen?.total_pollen_count || 0,
        air_quality: envData.air_quality?.aqi || 1,
        temperature: Math.round(envData.weather?.temperature || 20),
        humidity: envData.weather?.humidity || 50,
        // Additional real data
        wind_speed: envData.weather?.wind_speed || 0,
        weather_condition: envData.weather?.weather_condition || 'Clear',
        pm2_5: envData.air_quality?.pm2_5 || 0,
        pollen_risk: envData.pollen?.risk_level || 'low',
        // Location information
        city: location.city,
        region: location.region
      };
    } else {
      throw new Error(result.error || 'Failed to fetch environmental data');
    }
  } catch (error) {
    console.error('Error fetching environmental data:', error);
    
    // Check if we should retry
    const isRetryableError = (
      error.name === 'AbortError' || 
      error.message.includes('Network request failed') ||
      error.message.includes('timeout') ||
      error.message.includes('ECONNRESET') ||
      error.message.includes('ETIMEDOUT') ||
      (error.message.includes('HTTP 5') && error.message.includes(':')) // 5xx errors
    );
    
    if (isRetryableError && retryCount < MAX_RETRIES) {
      console.log(`Retrying in ${RETRY_DELAY}ms (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return fetchEnvironmentalData(retryCount + 1);
    }
    
    // After all retries failed or non-retryable error, throw with better context
    const errorMessage = error.name === 'AbortError' 
      ? 'Network request timed out - please check your internet connection'
      : error.message.includes('fetch') 
        ? 'Unable to connect to server - please check if the backend is running'
        : error.message;
    
    throw new Error(errorMessage);
  }
};

// Fetch comprehensive environmental risk assessment
export const fetchEnvironmentalRiskAssessment = async (userId = null) => {
  try {
    const location = await getCurrentLocation();
    
    const requestBody = {
      latitude: location.latitude,
      longitude: location.longitude
    };
    
    if (userId) {
      requestBody.userId = userId;
    }
    
    const response = await fetch(`${API_URL}/api/environmental/risk-assessment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success) {
      return {
        environmental_data: result.environmental_data,
        risk_assessment: result.risk_assessment,
        location: location
      };
    } else {
      throw new Error(result.error || 'Failed to fetch risk assessment');
    }
  } catch (error) {
    console.error('Error fetching risk assessment:', error);
    return null;
  }
};
  
  // Format date for display
  export const formatDate = (date) => {
    if (!date) return 'Unknown';
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  // Extract initials from name
  export const getInitials = (name) => {
    if (!name) return '?';
    
    const names = name.split(' ');
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }
    
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };