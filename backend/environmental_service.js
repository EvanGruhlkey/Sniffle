const axios = require('axios');

class EnvironmentalDataService {
    /**
     * Service to fetch real-time environmental data from various APIs
     */
    constructor() {
        // API keys from environment variables
        this.openweatherApiKey = process.env.OPENWEATHER_API_KEY;
        this.airQualityApiKey = process.env.AIR_QUALITY_API_KEY;

        // API endpoints
        this.openweatherBaseUrl = 'http://api.openweathermap.org/data/2.5';
        this.airQualityBaseUrl = 'http://api.openweathermap.org/data/2.5/air_pollution';
    }

    /**
     * Fetch current weather data from OpenWeatherMap
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {Promise<Object|null>} Weather data or null
     */
    async getWeatherData(lat, lon) {
        console.log(`Attempting to fetch weather data for lat=${lat}, lon=${lon}`);
        console.log(`OpenWeather API key present: ${!!this.openweatherApiKey}`);

        if (!this.openweatherApiKey) {
            console.log('ERROR: No OpenWeather API key found in environment variables!');
            return null;
        }

        const url = `${this.openweatherBaseUrl}/weather`;
        const params = {
            lat,
            lon,
            appid: this.openweatherApiKey,
            units: 'metric'
        };

        try {
            console.log(`Making API request to: ${url}`);
            const response = await axios.get(url, {
                params,
                timeout: 15000 // 15 seconds timeout
            });

            console.log(`API Response status: ${response.status}`);
            console.log('Successfully fetched real weather data!');

            const data = response.data;
            return {
                temperature: data.main.temp,
                humidity: data.main.humidity,
                pressure: data.main.pressure,
                wind_speed: data.wind.speed,
                wind_direction: data.wind.deg || 0,
                weather_condition: data.weather[0].main,
                weather_description: data.weather[0].description,
                visibility: (data.visibility || 10000) / 1000, // Convert to km
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                console.log('TIMEOUT: Weather API request timed out after 15 seconds');
            } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                console.log('CONNECTION ERROR: Could not connect to weather API');
            } else {
                console.log(`REQUEST ERROR fetching weather data: ${error.message}`);
                if (error.response) {
                    console.log(`Response content: ${JSON.stringify(error.response.data)}`);
                }
            }
            return null;
        }
    }

    /**
     * Fetch air quality data from OpenWeatherMap Air Pollution API
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {Promise<Object|null>} Air quality data or null
     */
    async getAirQualityData(lat, lon) {
        console.log(`Attempting to fetch air quality data for lat=${lat}, lon=${lon}`);

        if (!this.openweatherApiKey) {
            console.log('ERROR: No OpenWeather API key found for air quality!');
            return null;
        }

        const url = this.airQualityBaseUrl;
        const params = {
            lat,
            lon,
            appid: this.openweatherApiKey
        };

        try {
            console.log(`Making air quality API request to: ${url}`);
            const response = await axios.get(url, {
                params,
                timeout: 15000 // 15 seconds timeout
            });

            console.log(`Air quality API Response status: ${response.status}`);

            const data = response.data;
            if (data.list && data.list.length > 0) {
                const airData = data.list[0];
                const components = airData.components;
                console.log('Successfully fetched real air quality data!');

                return {
                    aqi: airData.main.aqi, // 1-5 scale
                    co: components.co || 0,
                    no2: components.no2 || 0,
                    o3: components.o3 || 0,
                    so2: components.so2 || 0,
                    pm2_5: components.pm2_5 || 0,
                    pm10: components.pm10 || 0,
                    nh3: components.nh3 || 0,
                    timestamp: new Date().toISOString()
                };
            }

            console.log('No air quality data in response');
            return null;
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                console.log('TIMEOUT: Air quality API request timed out after 15 seconds');
            } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                console.log('CONNECTION ERROR: Could not connect to air quality API');
            } else {
                console.log(`REQUEST ERROR fetching air quality data: ${error.message}`);
                if (error.response) {
                    console.log(`Response content: ${JSON.stringify(error.response.data)}`);
                }
            }
            return null;
        }
    }

    /**
     * Fetch pollen data - using static data for now as most pollen APIs are paid
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {Object} Pollen data
     */
    getPollenData(lat, lon) {
        console.log('Using static pollen data (real pollen APIs are typically paid)');
        // Return static but realistic pollen data for now
        return {
            tree_pollen: 2,
            grass_pollen: 1,
            weed_pollen: 1,
            total_pollen_count: 35,
            dominant_pollen_type: 'tree',
            risk_level: 'moderate',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get all environmental data for a location
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {Promise<Object>} Comprehensive environmental data
     */
    async getComprehensiveEnvironmentalData(lat, lon) {
        console.log(`Getting comprehensive environmental data for lat=${lat}, lon=${lon}`);

        const weatherData = await this.getWeatherData(lat, lon);
        const airQualityData = await this.getAirQualityData(lat, lon);
        const pollenData = this.getPollenData(lat, lon);

        // Check if we got real data
        if (!weatherData) {
            console.log('ERROR: Failed to get weather data - check your OPENWEATHER_API_KEY');
        }
        if (!airQualityData) {
            console.log('ERROR: Failed to get air quality data - check your OPENWEATHER_API_KEY');
        }

        return {
            weather: weatherData,
            air_quality: airQualityData,
            pollen: pollenData,
            location: {
                latitude: lat,
                longitude: lon
            },
            collected_at: new Date().toISOString()
        };
    }

    /**
     * Assess allergy risk based on environmental conditions and user allergens
     * @param {Object} environmentalData - Environmental data object
     * @param {Array} userAllergens - Array of user allergens
     * @returns {Object} Risk assessment
     */
    getAllergyRiskAssessment(environmentalData, userAllergens = []) {
        const riskFactors = [];
        let riskScore = 0;

        // Air quality impact
        const aqi = environmentalData.air_quality?.aqi || 1;
        if (aqi >= 3) {
            riskFactors.push('Poor air quality');
            riskScore += 2;
        }

        // Pollen impact
        const pollenData = environmentalData.pollen || {};
        const totalPollenCount = pollenData.total_pollen_count || 0;
        if (totalPollenCount > 50) {
            riskFactors.push('High pollen count');
            riskScore += 3;
        }

        // Weather impact
        const weather = environmentalData.weather || {};
        const humidity = weather.humidity || 50;
        if (humidity > 70) {
            riskFactors.push('High humidity');
            riskScore += 1;
        }

        const windSpeed = weather.wind_speed || 0;
        if (windSpeed > 10) {
            riskFactors.push('Strong winds (dispersing allergens)');
            riskScore += 1;
        }

        // Determine risk level
        let riskLevel;
        if (riskScore <= 1) {
            riskLevel = 'low';
        } else if (riskScore <= 3) {
            riskLevel = 'moderate';
        } else if (riskScore <= 5) {
            riskLevel = 'high';
        } else {
            riskLevel = 'very_high';
        }

        return {
            risk_level: riskLevel,
            risk_score: riskScore,
            contributing_factors: riskFactors,
            recommendations: this._getRecommendations(riskLevel, riskFactors),
            assessment_time: new Date().toISOString()
        };
    }

    /**
     * Get personalized recommendations based on risk assessment
     * @param {string} riskLevel - Risk level (low, moderate, high, very_high)
     * @param {Array} riskFactors - Array of risk factors
     * @returns {Array} Recommendations
     */
    _getRecommendations(riskLevel, riskFactors) {
        const recommendations = [];

        if (riskLevel === 'high' || riskLevel === 'very_high') {
            recommendations.push('Consider staying indoors during peak hours (10am-4pm)');
            recommendations.push('Keep windows closed and use air conditioning');
            recommendations.push('Take allergy medication as prescribed');
        }

        if (riskFactors.includes('High pollen count')) {
            recommendations.push('Shower and change clothes after being outside');
            recommendations.push('Avoid outdoor activities like gardening');
        }

        if (riskFactors.includes('Poor air quality')) {
            recommendations.push('Wear a mask if you must go outside');
            recommendations.push('Avoid outdoor exercise');
        }

        if (riskFactors.includes('High humidity')) {
            recommendations.push('Use a dehumidifier indoors');
            recommendations.push('Check for mold and mildew growth');
        }

        if (recommendations.length === 0) {
            recommendations.push('Conditions are favorable - enjoy outdoor activities!');
        }

        return recommendations;
    }
}

module.exports = EnvironmentalDataService;

