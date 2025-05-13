import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, firestore } from './firebase';

// Import screens
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import HomeScreen from './screens/HomeScreen';
import FoodLogScreen from './screens/FoodLogScreen';
import ProfileScreen from './screens/ProfileScreen';
import AllergyLogScreen from './screens/AllergyLogScreen';
import PredictionScreen from './screens/PredictionScreen';
import SetupScreen from './screens/SetupScreen';

// Context for user data
import { UserProvider } from './context/UserContext';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Main tab navigator for authenticated users
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Food Log') {
            iconName = focused ? 'restaurant' : 'restaurant-outline';
          } else if (route.name === 'Prediction') {
            iconName = focused ? 'analytics' : 'analytics-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6200ee',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Food Log" component={FoodLogScreen} />
      <Tab.Screen name="Prediction" component={PredictionScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [setupComplete, setSetupComplete] = useState(false);

  // Handle user state changes
  useEffect(() => {
    const subscriber = onAuthStateChanged(auth, handleAuthStateChanged);
    return subscriber; // unsubscribe on unmount
  }, []);

  async function handleAuthStateChanged(user) {
    setUser(user);
    
    if (user) {
      // Check if user has completed the setup
      try {
        const userDoc = await getDoc(doc(firestore, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setSetupComplete(userData.setupComplete || false);
        }
      } catch (error) {
        console.error("Error checking setup status:", error);
      }
    }
    
    if (initializing) setInitializing(false);
  }

  if (initializing) return null;

  return (
    <SafeAreaProvider>
      <UserProvider>
        <NavigationContainer>
          <StatusBar style="auto" />
          
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {user ? (
              setupComplete ? (
                <Stack.Screen name="Main" component={MainTabs} />
              ) : (
                <Stack.Screen name="Setup" component={SetupScreen} />
              )
            ) : (
              <>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Signup" component={SignupScreen} />
              </>
            )}
            <Stack.Screen 
              name="AllergyLog" 
              component={AllergyLogScreen}
              options={{ headerShown: true, title: "Log Allergy Reaction" }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </UserProvider>
    </SafeAreaProvider>
  );
}