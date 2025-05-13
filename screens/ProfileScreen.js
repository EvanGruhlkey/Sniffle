import React, { useState, useEffect, useContext } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  Alert, 
  TouchableOpacity,
  Switch
} from 'react-native';
import { 
  Avatar, 
  Card, 
  Title, 
  Paragraph, 
  Button, 
  Divider,
  List,
  Chip
} from 'react-native-paper';
import { auth, firestore } from '../firebase';
import { UserContext } from '../context/UserContext';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { userData, setUserData } = useContext(UserContext);
  const [loading, setLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  
  useEffect(() => {
    fetchUserPreferences();
  }, []);
  
  const fetchUserPreferences = async () => {
    try {
      const user = auth().currentUser;
      
      if (!user) return;
      
      const userDoc = await firestore()
        .collection('users')
        .doc(user.uid)
        .get();
        
      if (userDoc.exists) {
        const data = userDoc.data();
        
        // Set notification and location preferences
        setNotificationsEnabled(data.notifications_enabled !== false);
        setLocationEnabled(data.location_enabled !== false);
      }
    } catch (error) {
      console.error('Error fetching user preferences:', error);
    }
  };
  
  const updatePreference = async (preference, value) => {
    try {
      setLoading(true);
      const user = auth().currentUser;
      
      if (!user) return;
      
      const updateData = {};
      updateData[preference] = value;
      
      await firestore()
        .collection('users')
        .doc(user.uid)
        .update(updateData);
        
      // Update local state
      if (preference === 'notifications_enabled') {
        setNotificationsEnabled(value);
      } else if (preference === 'location_enabled') {
        setLocationEnabled(value);
      }
    } catch (error) {
      console.error(`Error updating ${preference}:`, error);
      Alert.alert('Error', `Failed to update your preferences`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSignOut = async () => {
    try {
      await auth().signOut();
      // The auth state listener in App.js will handle navigation
    } catch (error) {
      console.error('Sign out error:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };
  
  const confirmSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Sign Out', onPress: handleSignOut, style: 'destructive'},
      ]
    );
  };
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Avatar.Text 
            size={80} 
            label={userData?.name ? userData.name.substring(0, 2).toUpperCase() : 'U'} 
            color="#fff"
            style={styles.avatar}
          />
          <Text style={styles.userName}>{userData?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{userData?.email || 'No email'}</Text>
        </View>
        
        <Card style={styles.card}>
          <Card.Content>
            <Title>My Allergens</Title>
            <View style={styles.allergensContainer}>
              {userData?.allergens && userData.allergens.length > 0 ? (
                <View style={styles.allergenChips}>
                  {userData.allergens.map((allergen, index) => (
                    <Chip
                      key={index}
                      style={styles.allergenChip}
                      textStyle={styles.allergenChipText}
                    >
                      {allergen}
                    </Chip>
                  ))}
                </View>
              ) : (
                <Text style={styles.noDataText}>No allergens listed</Text>
              )}
            </View>
            <Button 
              mode="outlined" 
              style={styles.editButton}
              onPress={() => Alert.alert('Coming Soon', 'This feature will be available in a future update.')}
            >
              Edit Allergens
            </Button>
          </Card.Content>
        </Card>
        
        <Card style={styles.card}>
          <Card.Content>
            <Title>App Settings</Title>
            
            <List.Item
              title="Notifications"
              description="Receive alerts about high allergy risk"
              left={props => <List.Icon {...props} icon="bell" />}
              right={props => (
                <Switch
                  value={notificationsEnabled}
                  onValueChange={(value) => updatePreference('notifications_enabled', value)}
                  disabled={loading}
                />
              )}
            />
            
            <Divider />
            
            <List.Item
              title="Location Services"
              description="Use your location for environmental data"
              left={props => <List.Icon {...props} icon="map-marker" />}
              right={props => (
                <Switch
                  value={locationEnabled}
                  onValueChange={(value) => updatePreference('location_enabled', value)}
                  disabled={loading}
                />
              )}
            />
          </Card.Content>
        </Card>
        
        <Card style={styles.card}>
          <Card.Content>
            <Title>About Allergyx</Title>
            <Paragraph>
              Allergyx helps you predict and prevent allergy flare-ups by analyzing your history, 
              food intake, and environmental factors. We use machine learning to provide personalized
              risk assessments and alerts.
            </Paragraph>
            
            <View style={styles.versionContainer}>
              <Text style={styles.versionText}>Version 1.0.0</Text>
            </View>
          </Card.Content>
        </Card>
        
        <Button 
          mode="outlined" 
          onPress={confirmSignOut}
          style={styles.signOutButton}
          contentStyle={styles.signOutButtonContent}
          color="#ff6b6b"
        >
          Sign Out
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    backgroundColor: '#6200ee',
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  userEmail: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
    borderRadius: 8,
  },
  allergensContainer: {
    marginVertical: 16,
  },
  allergenChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  allergenChip: {
    margin: 4,
    backgroundColor: '#e1bee7',
  },
  allergenChipText: {
    color: '#333',
  },
  noDataText: {
    textAlign: 'center',
    padding: 16,
    color: '#666',
  },
  editButton: {
    borderColor: '#6200ee',
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  versionText: {
    color: '#999',
  },
  signOutButton: {
    marginTop: 8,
    borderColor: '#ff6b6b',
  },
  signOutButtonContent: {
    paddingVertical: 8,
  },
});