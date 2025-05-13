import numpy as np
import joblib
import os
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import pickle
from datetime import datetime

class AllergySeverityPredictor:
    def __init__(self, model_path=None):
        """Initialize the allergy severity prediction model."""
        if model_path and os.path.exists(model_path):
            self.load_model(model_path)
        else:
            # Initialize a new model
            self.model = RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                random_state=42
            )
            self.scaler = StandardScaler()
            self.feature_names = None
            
    def preprocess_features(self, data):
        """Convert input data into model features."""
        # Extract features from data
        features = []
        
        # User features
        allergens_count = len(data.get('allergens', []))
        severity_history = data.get('severity_history', [])
        avg_severity = np.mean([s.get('severity', 0) for s in severity_history]) if severity_history else 0
        
        # Food features
        food_items = [item for log in data.get('food_logs', []) for item in log.get('items', [])]
        risky_foods_count = sum(1 for food in food_items if food in data.get('allergens', []))
        
        # Environmental features
        env_data = data.get('environmental_data', [{}])[0]
        pollen_level = env_data.get('data', {}).get('pollen_count', 0)
        humidity = env_data.get('data', {}).get('humidity', 50)
        temperature = env_data.get('data', {}).get('temperature', 20)
        air_quality = env_data.get('data', {}).get('air_quality', 50)
        
        # Temporal features
        now = datetime.now()
        month = now.month
        day_of_week = now.weekday()
        
        # Combine all features
        features = [
            allergens_count,
            avg_severity,
            risky_foods_count,
            pollen_level,
            humidity,
            temperature,
            air_quality,
            month,
            day_of_week
        ]
        
        self.feature_names = [
            'allergens_count',
            'avg_severity',
            'risky_foods_count',
            'pollen_level',
            'humidity',
            'temperature',
            'air_quality',
            'month',
            'day_of_week'
        ]
        
        return np.array(features).reshape(1, -1)
    
    def train(self, X, y):
        """Train the model with new data."""
        if len(X.shape) == 1:
            X = X.reshape(1, -1)
            
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Train model
        self.model.fit(X_scaled, y)
        
    def predict(self, data):
        """Make a prediction for allergy severity risk."""
        # Preprocess the data
        features = self.preprocess_features(data)
        
        # Scale features
        if hasattr(self, 'scaler') and self.scaler is not None:
            features_scaled = self.scaler.transform(features)
        else:
            features_scaled = features
            
        # Get prediction probabilities
        try:
            # For a trained model
            probabilities = self.model.predict_proba(features_scaled)[0]
            risk_level = probabilities[1]  # Probability of class 1 (high risk)
            
            # Calculate feature importance
            feature_importance = {}
            if hasattr(self.model, 'feature_importances_') and self.feature_names:
                importances = self.model.feature_importances_
                feature_importance = dict(zip(self.feature_names, importances))
                
            # Find top contributing factors
            contributing_factors = []
            if feature_importance:
                sorted_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
                contributing_factors = [factor for factor, _ in sorted_features[:3]]
                
            return {
                'risk_level': risk_level,
                'confidence': np.max(probabilities),
                'contributing_factors': contributing_factors
            }
        except Exception as e:
            # For a new model without training, return a mock result
            print(f"Prediction error: {e}")
            # Mock a simple risk calculation based on risk factors
            mock_risk = min(0.1 * features[0][2] + 0.2 * features[0][0] + 0.3 * features[0][3], 1.0)
            return {
                'risk_level': float(mock_risk),
                'confidence': 0.5,  # Low confidence for mock prediction
                'contributing_factors': ['risky_foods_count', 'pollen_level', 'allergens_count']
            }
    
    def save_model(self, path):
        """Save the model to a file."""
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'feature_names': self.feature_names
        }
        with open(path, 'wb') as f:
            pickle.dump(model_data, f)
    
    def load_model(self, path):
        """Load a model from a file."""
        with open(path, 'rb') as f:
            model_data = pickle.load(f)
            
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.feature_names = model_data['feature_names']