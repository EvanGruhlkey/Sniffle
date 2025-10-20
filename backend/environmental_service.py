import requests
import os
from datetime import datetime
from typing import Dict, Optional

class EnvironmentalDataService:
    """Service to fetch real-time environmental data from various APIs"""
    
    def __init__(self):
        # API keys from environment variables
        self.openweather_api_key = os.getenv('OPENWEATHER_API_KEY')
        self.air_quality_api_key = os.getenv('AIR_QUALITY_API_KEY')
        
        # API endpoints
        self.openweather_base_url = "http://api.openweathermap.org/data/2.5"
        self.air_quality_base_url = "http://api.openweathermap.org/data/2.5/air_pollution"
        
    def get_weather_data(self, lat: float, lon: float) -> Optional[Dict]:
        """Fetch current weather data from OpenWeatherMap"""
        print(f"Attempting to fetch weather data for lat={lat}, lon={lon}")
        print(f"OpenWeather API key present: {bool(self.openweather_api_key)}")
        
        if not self.openweather_api_key:
            print("ERROR: No OpenWeather API key found in environment variables!")
            return None
                
        url = f"{self.openweather_base_url}/weather"
        params = {
            'lat': lat,
            'lon': lon,
            'appid': self.openweather_api_key,
            'units': 'metric'
        }
        
        try:
            print(f"Making API request to: {url}")
            response = requests.get(url, params=params, timeout=15)  # Increased timeout
            print(f"API Response status: {response.status_code}")
            response.raise_for_status()
            
            data = response.json()
            print("Successfully fetched real weather data!")
            
            return {
                'temperature': data['main']['temp'],
                'humidity': data['main']['humidity'],
                'pressure': data['main']['pressure'],
                'wind_speed': data['wind']['speed'],
                'wind_direction': data['wind'].get('deg', 0),
                'weather_condition': data['weather'][0]['main'],
                'weather_description': data['weather'][0]['description'],
                'visibility': data.get('visibility', 10000) / 1000,  # Convert to km
                'timestamp': datetime.now().isoformat()
            }
            
        except requests.exceptions.Timeout:
            print(f"TIMEOUT: Weather API request timed out after 15 seconds")
            return None
        except requests.exceptions.ConnectionError:
            print(f"CONNECTION ERROR: Could not connect to weather API")
            return None
        except requests.exceptions.RequestException as e:
            print(f"REQUEST ERROR fetching weather data: {e}")
            print(f"Response content: {response.text if 'response' in locals() else 'No response'}")
            return None
        except Exception as e:
            print(f"UNEXPECTED ERROR fetching weather data: {e}")
            return None
    
    def get_air_quality_data(self, lat: float, lon: float) -> Optional[Dict]:
        """Fetch air quality data from OpenWeatherMap Air Pollution API"""
        print(f"Attempting to fetch air quality data for lat={lat}, lon={lon}")
        
        if not self.openweather_api_key:
            print("ERROR: No OpenWeather API key found for air quality!")
            return None
                
        url = self.air_quality_base_url
        params = {
            'lat': lat,
            'lon': lon,
            'appid': self.openweather_api_key
        }
        
        try:
            print(f"Making air quality API request to: {url}")
            response = requests.get(url, params=params, timeout=15)  # Increased timeout
            print(f"Air quality API Response status: {response.status_code}")
            response.raise_for_status()
            
            data = response.json()
            
            if data['list']:
                air_data = data['list'][0]
                components = air_data['components']
                print("Successfully fetched real air quality data!")
                
                return {
                    'aqi': air_data['main']['aqi'],  # 1-5 scale
                    'co': components.get('co', 0),
                    'no2': components.get('no2', 0),
                    'o3': components.get('o3', 0),
                    'so2': components.get('so2', 0),
                    'pm2_5': components.get('pm2_5', 0),
                    'pm10': components.get('pm10', 0),
                    'nh3': components.get('nh3', 0),
                    'timestamp': datetime.now().isoformat()
                }
            
            print("No air quality data in response")
            return None
            
        except requests.exceptions.Timeout:
            print(f"TIMEOUT: Air quality API request timed out after 15 seconds")
            return None
        except requests.exceptions.ConnectionError:
            print(f"CONNECTION ERROR: Could not connect to air quality API")
            return None
        except requests.exceptions.RequestException as e:
            print(f"REQUEST ERROR fetching air quality data: {e}")
            print(f"Response content: {response.text if 'response' in locals() else 'No response'}")
            return None
        except Exception as e:
            print(f"UNEXPECTED ERROR fetching air quality data: {e}")
            return None
    
    def get_pollen_data(self, lat: float, lon: float) -> Optional[Dict]:
        """Fetch pollen data - using static data for now as most pollen APIs are paid"""
        print("Using static pollen data (real pollen APIs are typically paid)")
        # Return static but realistic pollen data for now
        return {
            'tree_pollen': 2,
            'grass_pollen': 1,
            'weed_pollen': 1,
            'total_pollen_count': 35,
            'dominant_pollen_type': 'tree',
            'risk_level': 'moderate',
            'timestamp': datetime.now().isoformat()
        }
    
    def get_comprehensive_environmental_data(self, lat: float, lon: float) -> Dict:
        """Get all environmental data for a location"""
        print(f"Getting comprehensive environmental data for lat={lat}, lon={lon}")
        
        weather_data = self.get_weather_data(lat, lon)
        air_quality_data = self.get_air_quality_data(lat, lon)
        pollen_data = self.get_pollen_data(lat, lon)
        
        # Check if we got real data
        if not weather_data:
            print("ERROR: Failed to get weather data - check your OPENWEATHER_API_KEY")
        if not air_quality_data:
            print("ERROR: Failed to get air quality data - check your OPENWEATHER_API_KEY")
        
        return {
            'weather': weather_data,
            'air_quality': air_quality_data,
            'pollen': pollen_data,
            'location': {
                'latitude': lat,
                'longitude': lon
            },
            'collected_at': datetime.now().isoformat()
        }
    
    
    def get_allergy_risk_assessment(self, environmental_data: Dict, user_allergens: list) -> Dict:
        """Assess allergy risk based on environmental conditions and user allergens"""
        risk_factors = []
        risk_score = 0
        
        # Air quality impact
        if environmental_data.get('air_quality', {}).get('aqi', 1) >= 3:
            risk_factors.append('Poor air quality')
            risk_score += 2
        
        # Pollen impact
        pollen_data = environmental_data.get('pollen', {})
        if pollen_data.get('total_pollen_count', 0) > 50:
            risk_factors.append('High pollen count')
            risk_score += 3
        
        # Weather impact
        weather = environmental_data.get('weather', {})
        if weather.get('humidity', 50) > 70:
            risk_factors.append('High humidity')
            risk_score += 1
        
        if weather.get('wind_speed', 0) > 10:
            risk_factors.append('Strong winds (dispersing allergens)')
            risk_score += 1
        
        # Determine risk level
        if risk_score <= 1:
            risk_level = 'low'
        elif risk_score <= 3:
            risk_level = 'moderate'
        elif risk_score <= 5:
            risk_level = 'high'
        else:
            risk_level = 'very_high'
        
        return {
            'risk_level': risk_level,
            'risk_score': risk_score,
            'contributing_factors': risk_factors,
            'recommendations': self._get_recommendations(risk_level, risk_factors),
            'assessment_time': datetime.now().isoformat()
        }
    
    def _get_recommendations(self, risk_level: str, risk_factors: list) -> list:
        """Get personalized recommendations based on risk assessment"""
        recommendations = []
        
        if risk_level in ['high', 'very_high']:
            recommendations.append('Consider staying indoors during peak hours (10am-4pm)')
            recommendations.append('Keep windows closed and use air conditioning')
            recommendations.append('Take allergy medication as prescribed')
        
        if 'High pollen count' in risk_factors:
            recommendations.append('Shower and change clothes after being outside')
            recommendations.append('Avoid outdoor activities like gardening')
        
        if 'Poor air quality' in risk_factors:
            recommendations.append('Wear a mask if you must go outside')
            recommendations.append('Avoid outdoor exercise')
        
        if 'High humidity' in risk_factors:
            recommendations.append('Use a dehumidifier indoors')
            recommendations.append('Check for mold and mildew growth')
        
        if not recommendations:
            recommendations.append('Conditions are favorable - enjoy outdoor activities!')
        
        return recommendations
