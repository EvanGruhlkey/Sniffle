import numpy as np
from datetime import datetime, timedelta
from collections import Counter

class DataProcessor:
    def __init__(self):
        # Known allergens and their typical severity scores for reference
        self.common_allergens = {
            'peanuts': 8,
            'tree nuts': 8,
            'milk': 6,
            'eggs': 6,
            'wheat': 5,
            'soy': 5,
            'fish': 7,
            'shellfish': 7,
            'sesame': 6
        }
        
    def process_for_prediction(self, user_data, food_logs, environmental_data):
        """Process user, food, and environmental data for prediction."""
        # Process user allergens
        allergens = user_data.get('allergens', [])
        
        # Process severity history
        severity_history = user_data.get('severity_history', [])
        
        # Process most recent food logs
        recent_food_items = []
        for log in food_logs:
            recent_food_items.extend(log.get('items', []))
        
        # Count food frequencies
        food_counts = Counter(recent_food_items)
        
        # Identify risky foods (foods that match user allergens)
        risky_foods = [food for food in recent_food_items if food in allergens]
        
        # Get most recent environmental data
        latest_env_data = environmental_data[0] if environmental_data else {}
        
        # Combine all processed data
        processed_data = {
            'allergens': allergens,
            'severity_history': severity_history,
            'food_logs': food_logs,
            'environmental_data': environmental_data,
            # Add additional processed features
            'food_frequency': dict(food_counts),
            'risky_foods': risky_foods,
        }
        
        return processed_data
        
    def extract_temporal_patterns(self, severity_history):
        """Extract temporal patterns from severity history."""
        if not severity_history:
            return {
                'daily_pattern': {},
                'monthly_pattern': {},
                'has_seasonal_pattern': False
            }
            
        # Convert timestamps to datetime objects
        timestamps = []
        severities = []
        
        for report in severity_history:
            if 'timestamp' in report and report['timestamp']:
                # Handle different timestamp formats
                if isinstance(report['timestamp'], str):
                    try:
                        ts = datetime.fromisoformat(report['timestamp'].replace('Z', '+00:00'))
                    except ValueError:
                        # Alternative parsing if ISO format fails
                        ts = datetime.strptime(report['timestamp'][:19], '%Y-%m-%dT%H:%M:%S')
                elif hasattr(report['timestamp'], 'todate'):
                    # Handle Firestore timestamp
                    ts = report['timestamp'].todate()
                else:
                    # Fallback
                    ts = datetime.now()
                
                timestamps.append(ts)
                severities.append(report.get('severity', 0))
        
        if not timestamps:
            return {
                'daily_pattern': {},
                'monthly_pattern': {},
                'has_seasonal_pattern': False
            }
            
        # Analyze daily patterns
        hours = [ts.hour for ts in timestamps]
        hour_severity = {}
        for h, s in zip(hours, severities):
            if h not in hour_severity:
                hour_severity[h] = []
            hour_severity[h].append(s)
            
        daily_pattern = {hour: np.mean(sevs) for hour, sevs in hour_severity.items()}
        
        # Analyze monthly patterns
        months = [ts.month for ts in timestamps]
        month_severity = {}
        for m, s in zip(months, severities):
            if m not in month_severity:
                month_severity[m] = []
            month_severity[m].append(s)
            
        monthly_pattern = {month: np.mean(sevs) for month, sevs in month_severity.items()}
        
        # Check for seasonal pattern
        spring = np.mean([monthly_pattern.get(m, 0) for m in [3, 4, 5]]) if any(m in monthly_pattern for m in [3, 4, 5]) else 0
        summer = np.mean([monthly_pattern.get(m, 0) for m in [6, 7, 8]]) if any(m in monthly_pattern for m in [6, 7, 8]) else 0
        fall = np.mean([monthly_pattern.get(m, 0) for m in [9, 10, 11]]) if any(m in monthly_pattern for m in [9, 10, 11]) else 0
        winter = np.mean([monthly_pattern.get(m, 0) for m in [12, 1, 2]]) if any(m in monthly_pattern for m in [12, 1, 2]) else 0
        
        seasonal_variance = np.std([spring, summer, fall, winter])
        has_seasonal_pattern = seasonal_variance > 1.5  # Threshold can be adjusted
        
        return {
            'daily_pattern': daily_pattern,
            'monthly_pattern': monthly_pattern,
            'has_seasonal_pattern': has_seasonal_pattern,
            'seasonal_severity': {
                'spring': spring,
                'summer': summer,
                'fall': fall,
                'winter': winter
            }
        }
    
    def analyze_food_correlations(self, food_logs, severity_history):
        """Analyze correlations between foods and allergy severity."""
        if not food_logs or not severity_history:
            return {}
            
        # Extract food timestamps and items
        food_data = []
        for log in food_logs:
            if 'timestamp' in log and 'items' in log:
                # Convert timestamp to datetime if needed
                if isinstance(log['timestamp'], str):
                    try:
                        ts = datetime.fromisoformat(log['timestamp'].replace('Z', '+00:00'))
                    except ValueError:
                        ts = datetime.strptime(log['timestamp'][:19], '%Y-%m-%dT%H:%M:%S')
                elif hasattr(log['timestamp'], 'todate'):
                    ts = log['timestamp'].todate()
                else:
                    ts = datetime.now()
                
                for item in log['items']:
                    food_data.append({
                        'item': item,
                        'timestamp': ts
                    })
        
        # Extract severity timestamps and levels
        severity_data = []
        for report in severity_history:
            if 'timestamp' in report and 'severity' in report:
                # Convert timestamp to datetime if needed
                if isinstance(report['timestamp'], str):
                    try:
                        ts = datetime.fromisoformat(report['timestamp'].replace('Z', '+00:00'))
                    except ValueError:
                        ts = datetime.strptime(report['timestamp'][:19], '%Y-%m-%dT%H:%M:%S')
                elif hasattr(report['timestamp'], 'todate'):
                    ts = report['timestamp'].todate()
                else:
                    ts = datetime.now()
                
                severity_data.append({
                    'severity': report['severity'],
                    'timestamp': ts
                })
        
        # For each food item, find severity reports within 24 hours after consumption
        food_correlations = {}
        
        for food_entry in food_data:
            food_item = food_entry['item']
            food_time = food_entry['timestamp']
            
            # Find severity reports within 24 hours
            related_severities = []
            for severity_entry in severity_data:
                time_diff = severity_entry['timestamp'] - food_time
                if timedelta(0) <= time_diff <= timedelta(hours=24):
                    related_severities.append(severity_entry['severity'])
            
            # If we found related severity reports, calculate the average severity
            if related_severities:
                if food_item not in food_correlations:
                    food_correlations[food_item] = []
                food_correlations[food_item].extend(related_severities)
        
        # Calculate average severity for each food
        average_correlations = {
            food: np.mean(severities) 
            for food, severities in food_correlations.items()
        }
        
        return average_correlations