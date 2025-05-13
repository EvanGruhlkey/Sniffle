// Helper functions for the application

// Get color for risk indicator based on risk level
export const getRiskColor = (riskLevel) => {
    if (riskLevel < 0.3) {
      return '#4caf50';  // Green for low risk
    } else if (riskLevel < 0.7) {
      return '#ff9800';  // Orange for medium risk
    } else {
      return '#f44336';  // Red for high risk
    }
  };
  
  // Mock function to fetch environmental data
  // In a real app, this would call a weather/environmental API
  export const fetchEnvironmentalData = async () => {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          pollen_level: Math.floor(Math.random() * 10) + 1,
          air_quality: Math.floor(Math.random() * 100) + 1,
          temperature: Math.floor(Math.random() * 30) + 5,
          humidity: Math.floor(Math.random() * 60) + 20
        });
      }, 1000);
    });
  };
  
  // Format date for display
  export const formatDate = (date) => {
    if (!date) return 'Unknown';
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  // Extract initials from name
  export const getInitials = (name) => {
    if (!name) return '?';
    
    const names = name.split(' ');
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }
    
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };