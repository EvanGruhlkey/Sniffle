from flask import Flask, jsonify, request
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore, auth
from dotenv import load_dotenv
import os
import json
import numpy as np
from datetime import datetime
from ml_models.prediction_model import AllergySeverityPredictor
from ml_models.data_processor import DataProcessor
from environmental_service import EnvironmentalDataService

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize Firebase Admin SDK
try:
    cred = credentials.Certificate("firebase_credentials.json")
    firebase_admin.initialize_app(cred)
    db = firestore.client()
except Exception as e:
    print(f"Firebase initialization error: {e}")
    # For development, we can continue without Firebase
    db = None

# Initialize ML models and services
predictor = AllergySeverityPredictor()
data_processor = DataProcessor()
env_service = EnvironmentalDataService()

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

@app.route('/api/users/register', methods=['POST'])
def register_user():
    try:
        user_data = request.json
        email = user_data.get('email')
        password = user_data.get('password')
        name = user_data.get('name')
        
        # Create user in Firebase Auth
        user = auth.create_user(
            email=email,
            password=password,
            display_name=name,
        )
        
        # Create user document in Firestore
        user_ref = db.collection('users').document(user.uid)
        user_ref.set({
            'name': name,
            'email': email,
            'allergens': user_data.get('allergens', []),
            'severity_history': [],
            'food_logs': [],
            'created_at': firestore.SERVER_TIMESTAMP
        })
        
        return jsonify({
            'success': True,
            'userId': user.uid,
            'message': 'User created successfully'
        }), 201
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

@app.route('/api/users/profile/<user_id>', methods=['GET'])
def get_user_profile(user_id):
    try:
        user_ref = db.collection('users').document(user_id)
        user = user_ref.get()
        
        if not user.exists:
            return jsonify({'success': False, 'error': 'User not found'}), 404
            
        user_data = user.to_dict()
        # Remove sensitive info
        if 'password' in user_data:
            del user_data['password']
            
        return jsonify({
            'success': True,
            'user': user_data
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/food/log', methods=['POST'])
def log_food():
    try:
        data = request.json
        user_id = data.get('userId')
        food_items = data.get('foodItems', [])
        
        if not user_id or not food_items:
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
            
        # Get user document
        user_ref = db.collection('users').document(user_id)
        
        # Add food log with timestamp
        food_log = {
            'items': food_items,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'notes': data.get('notes', '')
        }
        
        user_ref.update({
            'food_logs': firestore.ArrayUnion([food_log])
        })
        
        return jsonify({
            'success': True,
            'message': 'Food log added successfully'
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/environment/log', methods=['POST'])
def log_environment():
    try:
        data = request.json
        user_id = data.get('userId')
        env_data = data.get('environmentData', {})
        
        if not user_id or not env_data:
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
            
        # Get user document
        user_ref = db.collection('users').document(user_id)
        
        # Add environmental log with timestamp
        env_log = {
            'data': env_data,
            'timestamp': firestore.SERVER_TIMESTAMP
        }
        
        # Store in environment_logs subcollection
        user_ref.collection('environment_logs').add(env_log)
        
        return jsonify({
            'success': True,
            'message': 'Environment data logged successfully'
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/predict/allergy-risk', methods=['POST'])
def predict_allergy_risk():
    try:
        data = request.json
        user_id = data.get('userId')
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID is required'}), 400
        
        # Check if Firebase is available
        if db is None:
            # Return mock prediction data when Firebase is not available
            return jsonify({
                'success': True,
                'prediction': {
                    'risk_level': 6.5,
                    'confidence': 0.78,
                    'contributing_factors': ['High pollen count', 'Recent food allergen exposure'],
                    'timestamp': datetime.now().isoformat()
                }
            })
            
        # Get user data
        user_ref = db.collection('users').document(user_id)
        user = user_ref.get()
        
        if not user.exists:
            return jsonify({'success': False, 'error': 'User not found'}), 404
            
        user_data = user.to_dict()
        
        # Get recent food logs (last 5)
        food_logs = user_data.get('food_logs', [])[-5:]
        
        # Get environmental data (could be from external API or user input)
        env_logs = list(user_ref.collection('environment_logs').order_by('timestamp', direction='DESCENDING').limit(3).stream())
        env_data = [doc.to_dict() for doc in env_logs]
        
        # Process data for prediction
        processed_data = data_processor.process_for_prediction(
            user_data=user_data,
            food_logs=food_logs,
            environmental_data=env_data
        )
        
        # Make prediction
        prediction = predictor.predict(processed_data)
        
        # Format and return prediction
        return jsonify({
            'success': True,
            'prediction': {
                'risk_level': float(prediction['risk_level']),
                'confidence': float(prediction['confidence']),
                'contributing_factors': prediction['contributing_factors'],
                'timestamp': datetime.now().isoformat()
            }
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/allergy/report', methods=['POST'])
def report_allergy():
    try:
        data = request.json
        user_id = data.get('userId')
        severity = data.get('severity', 0)  # 0-10 scale
        symptoms = data.get('symptoms', [])
        notes = data.get('notes', '')
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID is required'}), 400
            
        # Create allergy report
        report = {
            'severity': severity,
            'symptoms': symptoms,
            'notes': notes,
            'timestamp': firestore.SERVER_TIMESTAMP
        }
        
        # Add to user's severity history
        user_ref = db.collection('users').document(user_id)
        user_ref.update({
            'severity_history': firestore.ArrayUnion([report])
        })
        
        # This reported data will be used to retrain and improve the model
        
        return jsonify({
            'success': True,
            'message': 'Allergy report saved successfully'
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/analysis/temporal-patterns', methods=['POST'])
def get_temporal_patterns():
    try:
        data = request.json
        user_id = data.get('userId')
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID is required'}), 400
        
        # For now, return mock data - you can implement real analysis later
        patterns = {
            'daily_pattern': {
                '8': 6.2,
                '12': 4.5,
                '18': 7.1,
                '22': 5.8
            },
            'monthly_pattern': {
                '1': 3.5,
                '4': 7.2,
                '7': 5.1,
                '10': 6.8
            },
            'has_seasonal_pattern': True,
            'seasonal_severity': {
                'spring': 7.2,
                'summer': 5.1,
                'fall': 6.8,
                'winter': 3.5
            }
        }
        
        return jsonify({
            'success': True,
            'patterns': patterns
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/analysis/risk-factors', methods=['POST'])
def get_risk_factors():
    try:
        data = request.json
        user_id = data.get('userId')
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID is required'}), 400
        
        # For now, return mock data - you can implement real analysis later
        risk_factors = [
            { 'factor': 'Pollen Count', 'weight': 0.35 },
            { 'factor': 'Food Allergens', 'weight': 0.28 },
            { 'factor': 'Weather Changes', 'weight': 0.22 },
            { 'factor': 'Time of Day', 'weight': 0.15 }
        ]
        
        return jsonify({
            'success': True,
            'riskFactors': risk_factors
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/environmental/current', methods=['POST'])
def get_current_environmental_data():
    try:
        data = request.json
        print(f"📨 Received request data: {data}")
        
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        print(f"📍 Extracted coordinates: lat={latitude}, lon={longitude}")
        
        if not latitude or not longitude:
            print("❌ Missing coordinates!")
            return jsonify({
                'success': False, 
                'error': 'Latitude and longitude are required'
            }), 400
        
        print(f"🌍 Calling environmental service with lat={float(latitude)}, lon={float(longitude)}")
        # Get comprehensive environmental data
        environmental_data = env_service.get_comprehensive_environmental_data(
            float(latitude), 
            float(longitude)
        )
        
        return jsonify({
            'success': True,
            'data': environmental_data
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/environmental/risk-assessment', methods=['POST'])
def get_environmental_risk_assessment():
    try:
        data = request.json
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        user_id = data.get('userId')
        
        if not all([latitude, longitude]):
            return jsonify({
                'success': False, 
                'error': 'Latitude and longitude are required'
            }), 400
        
        # Get environmental data
        environmental_data = env_service.get_comprehensive_environmental_data(
            float(latitude), 
            float(longitude)
        )
        
        # Get user allergens if userId provided
        user_allergens = []
        if user_id and db:
            try:
                user_ref = db.collection('users').document(user_id)
                user_doc = user_ref.get()
                if user_doc.exists():
                    user_data = user_doc.data()
                    user_allergens = user_data.get('allergens', [])
            except Exception as e:
                print(f"Could not fetch user allergens: {e}")
        
        # Get risk assessment
        risk_assessment = env_service.get_allergy_risk_assessment(
            environmental_data, 
            user_allergens
        )
        
        return jsonify({
            'success': True,
            'environmental_data': environmental_data,
            'risk_assessment': risk_assessment
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/environmental/weather', methods=['POST'])
def get_weather_data():
    try:
        data = request.json
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        
        if not latitude or not longitude:
            return jsonify({
                'success': False, 
                'error': 'Latitude and longitude are required'
            }), 400
        
        weather_data = env_service.get_weather_data(float(latitude), float(longitude))
        
        return jsonify({
            'success': True,
            'weather': weather_data
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/environmental/air-quality', methods=['POST'])
def get_air_quality_data():
    try:
        data = request.json
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        
        if not latitude or not longitude:
            return jsonify({
                'success': False, 
                'error': 'Latitude and longitude are required'
            }), 400
        
        air_quality_data = env_service.get_air_quality_data(float(latitude), float(longitude))
        
        return jsonify({
            'success': True,
            'air_quality': air_quality_data
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5000))) 