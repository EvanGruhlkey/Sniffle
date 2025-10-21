class AllergySeverityPredictor {
    constructor(modelPath = null) {
        /**
         * Initialize the allergy severity prediction model
         * Note: This is a rule-based predictor for Node.js
         * For advanced ML, consider using TensorFlow.js or ONNX Runtime
         */
        this.featureNames = [
            'allergens_count',
            'avg_severity',
            'risky_foods_count',
            'pollen_level',
            'humidity',
            'temperature',
            'air_quality',
            'month',
            'day_of_week'
        ];
    }

    /**
     * Convert input data into model features
     * @param {Object} data - Input data
     * @returns {Array} Feature array
     */
    preprocessFeatures(data) {
        // Extract features from data
        const features = [];

        // User features
        const allergensCount = data.allergens ? data.allergens.length : 0;
        const severityHistory = data.severity_history || [];
        const avgSeverity = severityHistory.length > 0
            ? severityHistory.reduce((sum, s) => sum + (s.severity || 0), 0) / severityHistory.length
            : 0;

        // Food features
        const foodItems = [];
        (data.food_logs || []).forEach(log => {
            if (log.items) {
                foodItems.push(...log.items);
            }
        });
        const allergens = data.allergens || [];
        const riskyFoodsCount = foodItems.filter(food => allergens.includes(food)).length;

        // Environmental features
        const envData = data.environmental_data && data.environmental_data.length > 0
            ? data.environmental_data[0]
            : {};
        
        const envDataObj = envData.data || {};
        const pollenLevel = envDataObj.pollen_count || 0;
        const humidity = envDataObj.humidity || 50;
        const temperature = envDataObj.temperature || 20;
        const airQuality = envDataObj.air_quality || 50;

        // Temporal features
        const now = new Date();
        const month = now.getMonth() + 1; // JavaScript months are 0-indexed
        const dayOfWeek = now.getDay();

        // Combine all features
        return [
            allergensCount,
            avgSeverity,
            riskyFoodsCount,
            pollenLevel,
            humidity,
            temperature,
            airQuality,
            month,
            dayOfWeek
        ];
    }

    /**
     * Make a prediction for allergy severity risk
     * @param {Object} data - Input data
     * @returns {Object} Prediction result with risk_level, confidence, and contributing_factors
     */
    predict(data) {
        try {
            // Preprocess the data
            const features = this.preprocessFeatures(data);

            // Extract individual features for rule-based prediction
            const [
                allergensCount,
                avgSeverity,
                riskyFoodsCount,
                pollenLevel,
                humidity,
                temperature,
                airQuality,
                month,
                dayOfWeek
            ] = features;

            // Rule-based risk calculation
            let riskScore = 0;
            const contributingFactors = [];

            // Allergen count impact (0-3 points)
            if (allergensCount > 5) {
                riskScore += 3;
                contributingFactors.push('Multiple allergens');
            } else if (allergensCount > 2) {
                riskScore += 2;
            } else if (allergensCount > 0) {
                riskScore += 1;
            }

            // Historical severity impact (0-3 points)
            if (avgSeverity > 7) {
                riskScore += 3;
                contributingFactors.push('High historical severity');
            } else if (avgSeverity > 5) {
                riskScore += 2;
            } else if (avgSeverity > 3) {
                riskScore += 1;
            }

            // Risky foods impact (0-4 points)
            if (riskyFoodsCount > 3) {
                riskScore += 4;
                contributingFactors.push('Recent allergen exposure');
            } else if (riskyFoodsCount > 1) {
                riskScore += 3;
                contributingFactors.push('Recent allergen exposure');
            } else if (riskyFoodsCount > 0) {
                riskScore += 2;
                contributingFactors.push('Recent allergen exposure');
            }

            // Pollen level impact (0-3 points)
            if (pollenLevel > 80) {
                riskScore += 3;
                contributingFactors.push('High pollen count');
            } else if (pollenLevel > 50) {
                riskScore += 2;
                contributingFactors.push('Moderate pollen count');
            } else if (pollenLevel > 20) {
                riskScore += 1;
            }

            // Humidity impact (0-2 points)
            if (humidity > 80) {
                riskScore += 2;
                contributingFactors.push('High humidity');
            } else if (humidity > 70) {
                riskScore += 1;
            }

            // Air quality impact (0-2 points)
            if (airQuality > 150) {
                riskScore += 2;
                contributingFactors.push('Poor air quality');
            } else if (airQuality > 100) {
                riskScore += 1;
                contributingFactors.push('Moderate air quality');
            }

            // Seasonal impact (0-2 points)
            // Spring (March-May) and Fall (September-November) are typically worse for allergies
            if ([3, 4, 5, 9, 10, 11].includes(month)) {
                riskScore += 2;
                contributingFactors.push('Peak allergy season');
            } else if ([6, 7, 8].includes(month)) {
                riskScore += 1;
            }

            // Normalize risk score to 0-10 scale
            const maxPossibleScore = 19; // Sum of all max points
            const normalizedRisk = (riskScore / maxPossibleScore) * 10;

            // Calculate confidence based on available data
            let confidence = 0.5; // Base confidence
            if (avgSeverity > 0) confidence += 0.15;
            if (riskyFoodsCount > 0) confidence += 0.15;
            if (pollenLevel > 0) confidence += 0.1;
            if (airQuality > 0) confidence += 0.1;
            confidence = Math.min(confidence, 0.95); // Cap at 0.95

            // Ensure we have at least 3 contributing factors
            if (contributingFactors.length === 0) {
                contributingFactors.push('Environmental factors', 'Seasonal patterns', 'Personal history');
            } else if (contributingFactors.length === 1) {
                contributingFactors.push('Environmental conditions', 'Personal allergy profile');
            } else if (contributingFactors.length === 2) {
                contributingFactors.push('Seasonal patterns');
            }

            return {
                risk_level: normalizedRisk,
                confidence: confidence,
                contributing_factors: contributingFactors.slice(0, 5) // Limit to top 5 factors
            };
        } catch (error) {
            console.error(`Prediction error: ${error.message}`);
            
            // Return a safe default prediction
            return {
                risk_level: 5.0,
                confidence: 0.3,
                contributing_factors: ['Unable to analyze all factors', 'Using default risk assessment']
            };
        }
    }

    /**
     * Train the model with new data
     * Note: This is a placeholder for future ML model training
     * @param {Array} X - Feature matrix
     * @param {Array} y - Target values
     */
    train(X, y) {
        console.log('Training not implemented for rule-based predictor');
        console.log('Consider using TensorFlow.js or ONNX Runtime for ML models');
    }

    /**
     * Save the model to a file
     * Note: This is a placeholder for future implementation
     * @param {string} path - File path
     */
    saveModel(path) {
        console.log(`Model saving not implemented for rule-based predictor`);
    }

    /**
     * Load a model from a file
     * Note: This is a placeholder for future implementation
     * @param {string} path - File path
     */
    loadModel(path) {
        console.log(`Model loading not implemented for rule-based predictor`);
    }
}

module.exports = AllergySeverityPredictor;

