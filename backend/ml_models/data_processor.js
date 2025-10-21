class DataProcessor {
    constructor() {
        // Known allergens and their typical severity scores for reference
        this.commonAllergens = {
            'peanuts': 8,
            'tree nuts': 8,
            'milk': 6,
            'eggs': 6,
            'wheat': 5,
            'soy': 5,
            'fish': 7,
            'shellfish': 7,
            'sesame': 6
        };
    }

    /**
     * Process user, food, and environmental data for prediction
     * @param {Object} options - Options containing userData, foodLogs, and environmentalData
     * @returns {Object} Processed data for prediction
     */
    processForPrediction({ userData, foodLogs, environmentalData }) {
        // Process user allergens
        const allergens = userData.allergens || [];

        // Process severity history
        const severityHistory = userData.severity_history || [];

        // Process most recent food logs
        const recentFoodItems = [];
        foodLogs.forEach(log => {
            if (log.items) {
                recentFoodItems.push(...log.items);
            }
        });

        // Count food frequencies
        const foodCounts = {};
        recentFoodItems.forEach(food => {
            foodCounts[food] = (foodCounts[food] || 0) + 1;
        });

        // Identify risky foods (foods that match user allergens)
        const riskyFoods = recentFoodItems.filter(food => allergens.includes(food));

        // Get most recent environmental data
        const latestEnvData = environmentalData.length > 0 ? environmentalData[0] : {};

        // Combine all processed data
        return {
            allergens,
            severity_history: severityHistory,
            food_logs: foodLogs,
            environmental_data: environmentalData,
            // Add additional processed features
            food_frequency: foodCounts,
            risky_foods: riskyFoods
        };
    }

    /**
     * Extract temporal patterns from severity history
     * @param {Array} severityHistory - Array of severity reports
     * @returns {Object} Temporal patterns
     */
    extractTemporalPatterns(severityHistory) {
        if (!severityHistory || severityHistory.length === 0) {
            return {
                daily_pattern: {},
                monthly_pattern: {},
                has_seasonal_pattern: false
            };
        }

        // Convert timestamps to Date objects
        const timestamps = [];
        const severities = [];

        severityHistory.forEach(report => {
            if (report.timestamp) {
                let ts;
                if (typeof report.timestamp === 'string') {
                    // Handle ISO string
                    ts = new Date(report.timestamp.replace('Z', '+00:00'));
                } else if (report.timestamp.toDate) {
                    // Handle Firestore timestamp
                    ts = report.timestamp.toDate();
                } else if (report.timestamp instanceof Date) {
                    ts = report.timestamp;
                } else {
                    ts = new Date();
                }

                timestamps.push(ts);
                severities.push(report.severity || 0);
            }
        });

        if (timestamps.length === 0) {
            return {
                daily_pattern: {},
                monthly_pattern: {},
                has_seasonal_pattern: false
            };
        }

        // Analyze daily patterns
        const hours = timestamps.map(ts => ts.getHours());
        const hourSeverity = {};
        hours.forEach((h, idx) => {
            if (!hourSeverity[h]) {
                hourSeverity[h] = [];
            }
            hourSeverity[h].push(severities[idx]);
        });

        const dailyPattern = {};
        Object.keys(hourSeverity).forEach(hour => {
            dailyPattern[hour] = this._mean(hourSeverity[hour]);
        });

        // Analyze monthly patterns
        const months = timestamps.map(ts => ts.getMonth() + 1); // JavaScript months are 0-indexed
        const monthSeverity = {};
        months.forEach((m, idx) => {
            if (!monthSeverity[m]) {
                monthSeverity[m] = [];
            }
            monthSeverity[m].push(severities[idx]);
        });

        const monthlyPattern = {};
        Object.keys(monthSeverity).forEach(month => {
            monthlyPattern[month] = this._mean(monthSeverity[month]);
        });

        // Check for seasonal pattern
        const spring = this._mean([3, 4, 5].map(m => monthlyPattern[m]).filter(v => v !== undefined));
        const summer = this._mean([6, 7, 8].map(m => monthlyPattern[m]).filter(v => v !== undefined));
        const fall = this._mean([9, 10, 11].map(m => monthlyPattern[m]).filter(v => v !== undefined));
        const winter = this._mean([12, 1, 2].map(m => monthlyPattern[m]).filter(v => v !== undefined));

        const seasonalValues = [spring, summer, fall, winter].filter(v => !isNaN(v));
        const seasonalVariance = this._std(seasonalValues);
        const hasSeasonalPattern = seasonalVariance > 1.5; // Threshold can be adjusted

        return {
            daily_pattern: dailyPattern,
            monthly_pattern: monthlyPattern,
            has_seasonal_pattern: hasSeasonalPattern,
            seasonal_severity: {
                spring: spring || 0,
                summer: summer || 0,
                fall: fall || 0,
                winter: winter || 0
            }
        };
    }

    /**
     * Analyze correlations between foods and allergy severity
     * @param {Array} foodLogs - Array of food logs
     * @param {Array} severityHistory - Array of severity reports
     * @returns {Object} Food correlations
     */
    analyzeFoodCorrelations(foodLogs, severityHistory) {
        if (!foodLogs || !severityHistory || foodLogs.length === 0 || severityHistory.length === 0) {
            return {};
        }

        // Extract food timestamps and items
        const foodData = [];
        foodLogs.forEach(log => {
            if (log.timestamp && log.items) {
                let ts;
                if (typeof log.timestamp === 'string') {
                    ts = new Date(log.timestamp.replace('Z', '+00:00'));
                } else if (log.timestamp.toDate) {
                    ts = log.timestamp.toDate();
                } else if (log.timestamp instanceof Date) {
                    ts = log.timestamp;
                } else {
                    ts = new Date();
                }

                log.items.forEach(item => {
                    foodData.push({
                        item,
                        timestamp: ts
                    });
                });
            }
        });

        // Extract severity timestamps and levels
        const severityData = [];
        severityHistory.forEach(report => {
            if (report.timestamp && report.severity !== undefined) {
                let ts;
                if (typeof report.timestamp === 'string') {
                    ts = new Date(report.timestamp.replace('Z', '+00:00'));
                } else if (report.timestamp.toDate) {
                    ts = report.timestamp.toDate();
                } else if (report.timestamp instanceof Date) {
                    ts = report.timestamp;
                } else {
                    ts = new Date();
                }

                severityData.push({
                    severity: report.severity,
                    timestamp: ts
                });
            }
        });

        // For each food item, find severity reports within 24 hours after consumption
        const foodCorrelations = {};

        foodData.forEach(foodEntry => {
            const foodItem = foodEntry.item;
            const foodTime = foodEntry.timestamp;

            // Find severity reports within 24 hours
            const relatedSeverities = [];
            severityData.forEach(severityEntry => {
                const timeDiff = severityEntry.timestamp - foodTime;
                const hours24 = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
                if (timeDiff >= 0 && timeDiff <= hours24) {
                    relatedSeverities.push(severityEntry.severity);
                }
            });

            // If we found related severity reports, calculate the average severity
            if (relatedSeverities.length > 0) {
                if (!foodCorrelations[foodItem]) {
                    foodCorrelations[foodItem] = [];
                }
                foodCorrelations[foodItem].push(...relatedSeverities);
            }
        });

        // Calculate average severity for each food
        const averageCorrelations = {};
        Object.keys(foodCorrelations).forEach(food => {
            averageCorrelations[food] = this._mean(foodCorrelations[food]);
        });

        return averageCorrelations;
    }

    /**
     * Calculate mean of an array
     * @param {Array} arr - Array of numbers
     * @returns {number} Mean value
     */
    _mean(arr) {
        if (!arr || arr.length === 0) return 0;
        return arr.reduce((sum, val) => sum + val, 0) / arr.length;
    }

    /**
     * Calculate standard deviation of an array
     * @param {Array} arr - Array of numbers
     * @returns {number} Standard deviation
     */
    _std(arr) {
        if (!arr || arr.length === 0) return 0;
        const mean = this._mean(arr);
        const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
        return Math.sqrt(variance);
    }
}

module.exports = DataProcessor;

