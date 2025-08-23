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
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function ProfileScreen() {
  const { userData, setUserData } = useContext(UserContext);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    loadUserProfile();
    fetchUserPreferences();
  }, []);
  
  const loadUserProfile = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
      if (userDoc.exists()) {
        setUser(userDoc.data());
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    }
  };
  
  const fetchUserPreferences = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      
      const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
        
      if (userDoc.exists()) {
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
      const currentUser = auth.currentUser;
      
      if (!currentUser) return;
      
      const updateData = {};
      updateData[preference] = value;
      
      await setDoc(doc(firestore, 'users', currentUser.uid), updateData, { merge: true });
        
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
  
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };
  
  const confirmSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Sign Out', onPress: handleLogout, style: 'destructive'},
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
              labelStyle={{ color: '#00CED1' }}
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
            <Title>About Sniffle</Title>
            <Paragraph>
              Sniffle helps you predict and prevent allergy flare-ups by analyzing your history, 
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
          labelStyle={{ color: '#ff6b6b' }}
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
    backgroundColor: '#E0FFFF', // Light Cyan
    padding: 20,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    backgroundColor: '#00CED1', // Deep Turquoise
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#008B8B', // Dark Cyan
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  userEmail: {
    fontSize: 18,
    color: '#20B2AA', // Light Sea Green
    marginTop: 8,
  },
  card: {
    marginBottom: 20,
    elevation: 4,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  allergensContainer: {
    marginVertical: 20,
  },
  allergenChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  allergenChip: {
    margin: 4,
    backgroundColor: '#00CED1', // Deep Turquoise
    elevation: 2,
  },
  allergenChipText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  noDataText: {
    textAlign: 'center',
    padding: 24,
    color: '#20B2AA', // Light Sea Green
    fontSize: 16,
  },
  editButton: {
    borderColor: '#00CED1', // Deep Turquoise
    color: '#00CED1', // Deep Turquoise
    marginTop: 12,
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  versionText: {
    color: '#20B2AA', // Light Sea Green
    fontSize: 14,
  },
  signOutButton: {
    marginTop: 16,
    borderColor: '#00CED1', // Deep Turquoise
    borderRadius: 12,
  },
  signOutButtonContent: {
    paddingVertical: 8,
  },
  insight: {
    backgroundColor: '#F0FFFF', // Azure
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});