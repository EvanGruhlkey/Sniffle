import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score
from sklearn.metrics import accuracy_score, precision_score, recall_score
import pickle
import os

class AllergySeverityPredictor:
    def __init__(self):
        """Initialize ML model with scikit-learn ensemble methods"""
        self.model = GradientBoostingClassifier(
            n_estimators=150,
            learning_rate=0.1,
            max_depth=5,
            min_samples_split=4,
            min_samples_leaf=2,
            subsample=0.8,
            random_state=42
        )
        self.scaler = StandardScaler()
        self.feature_names = [
            'allergens_count',
            'avg_historical_severity',
            'risky_foods_count',
            'days_since_last_reaction',
            'pollen_level',
            'humidity',
            'temperature',
            'air_quality_index',
            'wind_speed',
            'month',
            'hour_of_day',
            'season_risk_factor'
        ]
        self.is_fitted = False
        self._load_pretrained_model()
    
    def _load_pretrained_model(self):
        """Load pre-trained model if available"""
        model_path = 'trained_model.pkl'
        if os.path.exists(model_path):
            try:
                with open(model_path, 'rb') as f:
                    saved_data = pickle.load(f)
                    self.model = saved_data['model']
                    self.scaler = saved_data['scaler']
                    self.feature_names = saved_data['feature_names']
                    self.is_fitted = True
                    print('Loaded pre-trained model')
            except Exception as e:
                print(f'Error loading model: {e}')
                self._train_with_synthetic_data()
        else:
            self._train_with_synthetic_data()
    
    def _train_with_synthetic_data(self):
        """Train model with synthetic data for initial deployment"""
        print('Training model with synthetic data...')
        np.random.seed(42)
        n_samples = 1000
        
        # Generate synthetic training data
        X = np.random.randn(n_samples, len(self.feature_names))
        
        # Create realistic risk scores based on features
        y = (
            0.3 * X[:, 0] +  # allergens_count
            0.25 * X[:, 1] +  # avg_historical_severity
            0.2 * X[:, 2] +  # risky_foods_count
            0.15 * X[:, 4] +  # pollen_level
            0.1 * X[:, 7] +  # air_quality_index
            np.random.randn(n_samples) * 0.3  # noise
        )
        
        # Convert to binary classification (high risk vs low risk)
        y_binary = (y > np.median(y)).astype(int)
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Train model
        self.model.fit(X_scaled, y_binary)
        self.is_fitted = True
        
        # Calculate baseline accuracy improvement
        baseline_accuracy = 0.50  # Random guess
        cv_scores = cross_val_score(self.model, X_scaled, y_binary, cv=5)
        model_accuracy = cv_scores.mean()
        improvement = ((model_accuracy - baseline_accuracy) / baseline_accuracy) * 100
        
        print(f'Model trained. Accuracy: {model_accuracy:.3f}')
        print(f'Improvement over baseline: {improvement:.1f}%')
        
        # Save model
        self.save_model()
    
    def extract_features(self, processed_data):
        """Extract feature vector from processed data"""
        features = [
            processed_data.get('allergens_count', 0),
            processed_data.get('avg_historical_severity', 0),
            processed_data.get('risky_foods_count', 0),
            processed_data.get('days_since_last_reaction', 30),
            processed_data.get('pollen_level', 0),
            processed_data.get('humidity', 50),
            processed_data.get('temperature', 20),
            processed_data.get('air_quality_index', 50),
            processed_data.get('wind_speed', 0),
            processed_data.get('month', 6),
            processed_data.get('hour_of_day', 12),
            processed_data.get('season_risk_factor', 0.5)
        ]
        return np.array(features).reshape(1, -1)
    
    def predict(self, processed_data):
        """Make prediction with probability distribution"""
        if not self.is_fitted:
            raise ValueError('Model not trained')
        
        # Extract features
        features = self.extract_features(processed_data)
        features_scaled = self.scaler.transform(features)
        
        # Get prediction probabilities
        probabilities = self.model.predict_proba(features_scaled)[0]
        prediction_class = self.model.predict(features_scaled)[0]
        
        # Calculate risk score (0-10 scale)
        risk_score = probabilities[1] * 10
        
        # Get feature importance
        feature_importance = dict(zip(
            self.feature_names,
            self.model.feature_importances_
        ))
        
        # Identify top contributing factors
        sorted_features = sorted(
            feature_importance.items(),
            key=lambda x: x[1],
            reverse=True
        )
        contributing_factors = [
            self._format_factor_name(factor)
            for factor, importance in sorted_features[:5]
            if importance > 0.05
        ]
        
        return {
            'risk_score': risk_score,
            'confidence': max(probabilities),
            'probability_distribution': {
                'low_risk': float(probabilities[0]),
                'high_risk': float(probabilities[1])
            },
            'contributing_factors': contributing_factors,
            'feature_importance': {
                k: float(v) for k, v in feature_importance.items()
            }
        }
    
    def train(self, X, y):
        """Train model with new data"""
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Train model
        self.model.fit(X_scaled, y)
        self.is_fitted = True
        
        # Calculate metrics
        y_pred = self.model.predict(X_scaled)
        metrics = {
            'accuracy': float(accuracy_score(y, y_pred)),
            'precision': float(precision_score(y, y_pred, average='weighted')),
            'recall': float(recall_score(y, y_pred, average='weighted'))
        }
        
        # Save updated model
        self.save_model()
        
        return metrics
    
    def save_model(self):
        """Save trained model to disk"""
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'feature_names': self.feature_names
        }
        with open('trained_model.pkl', 'wb') as f:
            pickle.dump(model_data, f)
    
    def is_trained(self):
        """Check if model is trained"""
        return self.is_fitted
    
    def _format_factor_name(self, factor):
        """Convert feature name to readable format"""
        name_map = {
            'allergens_count': 'Number of allergens',
            'avg_historical_severity': 'Historical severity',
            'risky_foods_count': 'Recent allergen exposure',
            'days_since_last_reaction': 'Time since last reaction',
            'pollen_level': 'Pollen count',
            'humidity': 'High humidity',
            'temperature': 'Temperature',
            'air_quality_index': 'Air quality',
            'wind_speed': 'Wind conditions',
            'month': 'Seasonal factors',
            'hour_of_day': 'Time of day',
            'season_risk_factor': 'Seasonal patterns'
        }
        return name_map.get(factor, factor)

