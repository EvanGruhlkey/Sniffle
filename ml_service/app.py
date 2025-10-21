from flask import Flask, jsonify, request
from flask_cors import CORS
from prediction_model import AllergySeverityPredictor
from data_processor import DataProcessor
import os

app = Flask(__name__)
CORS(app)

# Initialize ML components
predictor = AllergySeverityPredictor()
data_processor = DataProcessor()

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'ml-prediction',
        'model_loaded': predictor.is_trained()
    })

@app.route('/api/predict/allergy-risk', methods=['POST'])
def predict_allergy_risk():
    try:
        data = request.json
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        # Process input data with probability distributions
        processed_data = data_processor.process_for_prediction(data)
        
        # Get ML prediction
        prediction = predictor.predict(processed_data)
        
        # Apply probability distributions for tailored alerts
        alert_config = data_processor.generate_tailored_alerts(
            prediction, 
            processed_data
        )
        
        return jsonify({
            'success': True,
            'prediction': {
                'risk_level': float(prediction['risk_score']),
                'confidence': float(prediction['confidence']),
                'contributing_factors': prediction['contributing_factors'],
                'probability_distribution': prediction['probability_distribution'],
                'tailored_alerts': alert_config
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/train/update', methods=['POST'])
def update_model():
    """Endpoint to retrain model with new user data"""
    try:
        data = request.json
        training_samples = data.get('samples', [])
        
        if not training_samples:
            return jsonify({
                'success': False,
                'error': 'No training samples provided'
            }), 400
        
        # Process training data
        X, y = data_processor.prepare_training_data(training_samples)
        
        # Retrain model
        metrics = predictor.train(X, y)
        
        return jsonify({
            'success': True,
            'metrics': metrics,
            'message': 'Model updated successfully'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    PORT = int(os.environ.get('PORT', 5001))
    print(f'ML Service starting on port {PORT}')
    app.run(debug=True, host='0.0.0.0', port=PORT)

