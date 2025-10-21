import numpy as np
from datetime import datetime, timedelta
from scipy import stats

class DataProcessor:
    def __init__(self):
        """Initialize data processor with probability distributions"""
        self.season_risk_map = {
            'spring': 0.85,  # High pollen season
            'summer': 0.60,
            'fall': 0.75,
            'winter': 0.40
        }
    
    def process_for_prediction(self, data):
        """Process raw data into features with probability distributions"""
        # Extract user data
        user_data = data.get('userData', {})
        food_logs = data.get('foodLogs', [])
        env_data = data.get('environmentalData', [{}])[0]
        
        # Process allergen information
        allergens = user_data.get('allergens', [])
        allergens_count = len(allergens)
        
        # Process severity history with statistical distribution
        severity_history = user_data.get('severity_history', [])
        avg_severity, severity_std = self._analyze_severity_distribution(severity_history)
        
        # Process food logs for risky exposures
        risky_foods = self._identify_risky_foods(food_logs, allergens)
        
        # Calculate time-based features
        days_since_last = self._days_since_last_reaction(severity_history)
        
        # Extract environmental features
        env_features = self._extract_environmental_features(env_data)
        
        # Calculate temporal features with probability
        temporal_features = self._calculate_temporal_risk()
        
        # Combine all features
        processed = {
            'allergens_count': allergens_count,
            'avg_historical_severity': avg_severity,
            'severity_std': severity_std,
            'risky_foods_count': len(risky_foods),
            'days_since_last_reaction': days_since_last,
            **env_features,
            **temporal_features
        }
        
        return processed
    
    def _analyze_severity_distribution(self, severity_history):
        """Apply probability distribution to severity data"""
        if not severity_history:
            return 0, 0
        
        severities = [r.get('severity', 0) for r in severity_history]
        
        if len(severities) < 2:
            return severities[0] if severities else 0, 0
        
        # Calculate distribution parameters
        mean = np.mean(severities)
        std = np.std(severities)
        
        return mean, std
    
    def _identify_risky_foods(self, food_logs, allergens):
        """Identify recent exposure to allergens"""
        risky_foods = []
        
        for log in food_logs[-5:]:  # Last 5 food logs
            items = log.get('items', [])
            for item in items:
                if any(allergen.lower() in item.lower() for allergen in allergens):
                    risky_foods.append(item)
        
        return risky_foods
    
    def _days_since_last_reaction(self, severity_history):
        """Calculate days since last allergic reaction"""
        if not severity_history:
            return 30  # Default if no history
        
        try:
            last_reaction = severity_history[-1]
            timestamp = last_reaction.get('timestamp')
            
            if timestamp:
                if hasattr(timestamp, 'toDate'):
                    reaction_date = timestamp.toDate()
                else:
                    reaction_date = datetime.fromisoformat(str(timestamp).replace('Z', '+00:00'))
                
                days = (datetime.now() - reaction_date).days
                return max(0, days)
        except:
            pass
        
        return 30
    
    def _extract_environmental_features(self, env_data):
        """Extract environmental features from data"""
        weather = env_data.get('weather', {}) if env_data else {}
        air_quality = env_data.get('air_quality', {}) if env_data else {}
        pollen = env_data.get('pollen', {}) if env_data else {}
        
        return {
            'pollen_level': pollen.get('total_pollen_count', 0),
            'humidity': weather.get('humidity', 50),
            'temperature': weather.get('temperature', 20),
            'air_quality_index': air_quality.get('aqi', 1) * 20,  # Convert 1-5 to 0-100
            'wind_speed': weather.get('wind_speed', 0)
        }
    
    def _calculate_temporal_risk(self):
        """Calculate risk factors based on time with probability distribution"""
        now = datetime.now()
        month = now.month
        hour = now.hour
        
        # Determine season
        if month in [3, 4, 5]:
            season = 'spring'
        elif month in [6, 7, 8]:
            season = 'summer'
        elif month in [9, 10, 11]:
            season = 'fall'
        else:
            season = 'winter'
        
        season_risk = self.season_risk_map[season]
        
        return {
            'month': month,
            'hour_of_day': hour,
            'season_risk_factor': season_risk
        }
    
    def generate_tailored_alerts(self, prediction, processed_data):
        """Generate personalized alerts using probability distributions"""
        risk_score = prediction['risk_score']
        prob_dist = prediction['probability_distribution']
        
        alerts = {
            'priority': self._calculate_alert_priority(risk_score, prob_dist),
            'recommendations': [],
            'risk_level_text': self._get_risk_level_text(risk_score),
            'confidence_level': prediction['confidence']
        }
        
        # Generate tailored recommendations based on probability
        if prob_dist['high_risk'] > 0.7:
            alerts['recommendations'].extend([
                'High risk detected - consider taking preventive medication',
                'Avoid outdoor activities during peak hours',
                'Keep windows closed to minimize allergen exposure'
            ])
        elif prob_dist['high_risk'] > 0.5:
            alerts['recommendations'].extend([
                'Moderate risk - monitor your symptoms closely',
                'Have allergy medication readily available',
                'Check pollen forecasts before going outside'
            ])
        else:
            alerts['recommendations'].append(
                'Low risk conditions - normal precautions sufficient'
            )
        
        # Add environmental-specific alerts
        if processed_data.get('pollen_level', 0) > 50:
            alerts['recommendations'].append(
                'High pollen count detected - extra caution advised'
            )
        
        if processed_data.get('air_quality_index', 50) > 100:
            alerts['recommendations'].append(
                'Poor air quality - wear a mask if going outdoors'
            )
        
        return alerts
    
    def _calculate_alert_priority(self, risk_score, prob_dist):
        """Calculate alert priority using probability threshold"""
        if risk_score > 7.5 and prob_dist['high_risk'] > 0.75:
            return 'critical'
        elif risk_score > 5.5 and prob_dist['high_risk'] > 0.6:
            return 'high'
        elif risk_score > 3.5:
            return 'medium'
        else:
            return 'low'
    
    def _get_risk_level_text(self, risk_score):
        """Convert risk score to text description"""
        if risk_score > 7.5:
            return 'Very High Risk'
        elif risk_score > 5.5:
            return 'High Risk'
        elif risk_score > 3.5:
            return 'Moderate Risk'
        else:
            return 'Low Risk'
    
    def prepare_training_data(self, samples):
        """Prepare training data from user feedback"""
        X = []
        y = []
        
        for sample in samples:
            features = self.process_for_prediction(sample['data'])
            feature_vector = [
                features.get('allergens_count', 0),
                features.get('avg_historical_severity', 0),
                features.get('risky_foods_count', 0),
                features.get('days_since_last_reaction', 30),
                features.get('pollen_level', 0),
                features.get('humidity', 50),
                features.get('temperature', 20),
                features.get('air_quality_index', 50),
                features.get('wind_speed', 0),
                features.get('month', 6),
                features.get('hour_of_day', 12),
                features.get('season_risk_factor', 0.5)
            ]
            X.append(feature_vector)
            
            # Binary classification: high severity (1) vs low severity (0)
            severity = sample.get('actual_severity', 5)
            y.append(1 if severity > 5 else 0)
        
        return np.array(X), np.array(y)

