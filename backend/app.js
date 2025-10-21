const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const EnvironmentalDataService = require('./environmental_service');
const AllergySeverityPredictor = require('./ml_models/prediction_model');
const DataProcessor = require('./ml_models/data_processor');

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK
let db = null;
try {
    const serviceAccount = require('./firebase_credentials.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error(`Firebase initialization error: ${error.message}`);
    // For development, we can continue without Firebase
}

// Initialize ML models and services
const predictor = new AllergySeverityPredictor();
const dataProcessor = new DataProcessor();
const envService = new EnvironmentalDataService();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// User registration endpoint
app.post('/api/users/register', async (req, res) => {
    try {
        const { email, password, name, allergens = [] } = req.body;

        // Create user in Firebase Auth
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name
        });

        // Create user document in Firestore
        const userRef = db.collection('users').doc(userRecord.uid);
        await userRef.set({
            name,
            email,
            allergens,
            severity_history: [],
            food_logs: [],
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(201).json({
            success: true,
            userId: userRecord.uid,
            message: 'User created successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Get user profile
app.get('/api/users/profile/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;
        const userRef = db.collection('users').doc(user_id);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const userData = userDoc.data();
        // Remove sensitive info
        delete userData.password;

        res.json({
            success: true,
            user: userData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Log food items
app.post('/api/food/log', async (req, res) => {
    try {
        const { userId, foodItems = [], notes = '' } = req.body;

        if (!userId || !foodItems.length) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Get user document
        const userRef = db.collection('users').doc(userId);

        // Add food log with timestamp
        const foodLog = {
            items: foodItems,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            notes
        };

        await userRef.update({
            food_logs: admin.firestore.FieldValue.arrayUnion(foodLog)
        });

        res.json({
            success: true,
            message: 'Food log added successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Log environmental data
app.post('/api/environment/log', async (req, res) => {
    try {
        const { userId, environmentData = {} } = req.body;

        if (!userId || !Object.keys(environmentData).length) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Get user document
        const userRef = db.collection('users').doc(userId);

        // Add environmental log with timestamp
        const envLog = {
            data: environmentData,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        };

        // Store in environment_logs subcollection
        await userRef.collection('environment_logs').add(envLog);

        res.json({
            success: true,
            message: 'Environment data logged successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Predict allergy risk
app.post('/api/predict/allergy-risk', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        // Check if Firebase is available
        if (!db) {
            // Return mock prediction data when Firebase is not available
            return res.json({
                success: true,
                prediction: {
                    risk_level: 6.5,
                    confidence: 0.78,
                    contributing_factors: ['High pollen count', 'Recent food allergen exposure'],
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Get user data
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const userData = userDoc.data();

        // Get recent food logs (last 5)
        const foodLogs = (userData.food_logs || []).slice(-5);

        // Get environmental data (last 3 entries)
        const envLogsSnapshot = await userRef
            .collection('environment_logs')
            .orderBy('timestamp', 'desc')
            .limit(3)
            .get();

        const envData = envLogsSnapshot.docs.map(doc => doc.data());

        // Process data for prediction
        const processedData = dataProcessor.processForPrediction({
            userData,
            foodLogs,
            environmentalData: envData
        });

        // Make prediction
        const prediction = predictor.predict(processedData);

        // Format and return prediction
        res.json({
            success: true,
            prediction: {
                risk_level: parseFloat(prediction.risk_level),
                confidence: parseFloat(prediction.confidence),
                contributing_factors: prediction.contributing_factors,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Report allergy symptoms
app.post('/api/allergy/report', async (req, res) => {
    try {
        const { userId, severity = 0, symptoms = [], notes = '' } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        // Create allergy report
        const report = {
            severity,
            symptoms,
            notes,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        };

        // Add to user's severity history
        const userRef = db.collection('users').doc(userId);
        await userRef.update({
            severity_history: admin.firestore.FieldValue.arrayUnion(report)
        });

        // This reported data will be used to retrain and improve the model

        res.json({
            success: true,
            message: 'Allergy report saved successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get temporal patterns
app.post('/api/analysis/temporal-patterns', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        // For now, return mock data - you can implement real analysis later
        const patterns = {
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
                spring: 7.2,
                summer: 5.1,
                fall: 6.8,
                winter: 3.5
            }
        };

        res.json({
            success: true,
            patterns
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get risk factors
app.post('/api/analysis/risk-factors', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        // For now, return mock data - you can implement real analysis later
        const riskFactors = [
            { factor: 'Pollen Count', weight: 0.35 },
            { factor: 'Food Allergens', weight: 0.28 },
            { factor: 'Weather Changes', weight: 0.22 },
            { factor: 'Time of Day', weight: 0.15 }
        ];

        res.json({
            success: true,
            riskFactors
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get current environmental data
app.post('/api/environmental/current', async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        console.log(`Received request data:`, req.body);
        console.log(`Extracted coordinates: lat=${latitude}, lon=${longitude}`);

        if (!latitude || !longitude) {
            console.log('Missing coordinates!');
            return res.status(400).json({
                success: false,
                error: 'Latitude and longitude are required'
            });
        }

        console.log(`Calling environmental service with lat=${latitude}, lon=${longitude}`);
        // Get comprehensive environmental data
        const environmentalData = await envService.getComprehensiveEnvironmentalData(
            parseFloat(latitude),
            parseFloat(longitude)
        );

        res.json({
            success: true,
            data: environmentalData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get environmental risk assessment
app.post('/api/environmental/risk-assessment', async (req, res) => {
    try {
        const { latitude, longitude, userId } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                error: 'Latitude and longitude are required'
            });
        }

        // Get environmental data
        const environmentalData = await envService.getComprehensiveEnvironmentalData(
            parseFloat(latitude),
            parseFloat(longitude)
        );

        // Get user allergens if userId provided
        let userAllergens = [];
        if (userId && db) {
            try {
                const userRef = db.collection('users').doc(userId);
                const userDoc = await userRef.get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    userAllergens = userData.allergens || [];
                }
            } catch (error) {
                console.log(`Could not fetch user allergens: ${error.message}`);
            }
        }

        // Get risk assessment
        const riskAssessment = envService.getAllergyRiskAssessment(
            environmentalData,
            userAllergens
        );

        res.json({
            success: true,
            environmental_data: environmentalData,
            risk_assessment: riskAssessment
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get weather data
app.post('/api/environmental/weather', async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                error: 'Latitude and longitude are required'
            });
        }

        const weatherData = await envService.getWeatherData(
            parseFloat(latitude),
            parseFloat(longitude)
        );

        res.json({
            success: true,
            weather: weatherData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get air quality data
app.post('/api/environmental/air-quality', async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                error: 'Latitude and longitude are required'
            });
        }

        const airQualityData = await envService.getAirQualityData(
            parseFloat(latitude),
            parseFloat(longitude)
        );

        res.json({
            success: true,
            air_quality: airQualityData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;

