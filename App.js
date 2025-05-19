import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { auth, firestore } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot, doc } from 'firebase/firestore';
import { View, Text } from 'react-native';
import { PaperProvider, DefaultTheme } from 'react-native-paper';

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

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#00CED1', // Deep Turquoise for outlines and primary elements
    accent: '#40E0D0', // Turquoise
    background: '#E0FFFF', // Light Cyan
    surface: '#FFFFFF', // White
    text: '#333333', // Dark grey
    onSurface: '#333333', // Dark grey
    onBackground: '#333333', // Dark grey
    // You can add other colors here as needed
  },
};

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
        tabBarActiveTintColor: '#00CED1', // Deep Turquoise
        tabBarInactiveTintColor: '#20B2AA', // Light Sea Green
        tabBarStyle: {
          backgroundColor: '#E0FFFF', // Light Cyan
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#E0FFFF',
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          color: '#008B8B', // Dark Cyan
          fontWeight: 'bold',
          fontSize: 20,
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          title: 'Dashboard',
        }}
      />
      <Tab.Screen 
        name="Food Log" 
        component={FoodLogScreen}
        options={{
          title: 'Food Log',
        }}
      />
      <Tab.Screen 
        name="Prediction" 
        component={PredictionScreen}
        options={{
          title: 'Predictions',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          title: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [setupComplete, setSetupComplete] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  // Handle user state changes
  useEffect(() => {
    console.log('App.js: Setting up auth state listener');
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('App.js: Auth state changed. User:', user ? user.uid : 'null');
      setUser(user);
      // Setting initializing to false here, assuming auth state is the first thing we check
      setInitializing(false);
    });

    // Cleanup function for auth listener
    return () => {
      console.log('App.js: Cleaning up auth listener');
      authUnsubscribe();
    };
  }, []); // Empty dependency array means this runs once on mount

  // Handle user document snapshot listener
  useEffect(() => {
    let unsubscribeSnapshot = () => {}; // Initialize as a no-op function

    if (user) {
      console.log('App.js: User logged in, setting up Firestore listener for user:', user.uid);
      const userDocRef = doc(firestore, 'users', user.uid);

      // Set up real-time listener for user document
      unsubscribeSnapshot = onSnapshot(userDocRef, (docSnapshot) => {
        console.log('App.js: Firestore snapshot received');
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();
          console.log('App.js: User data from snapshot:', userData);
          const isSetupComplete = userData.setupComplete || false;
          console.log('App.js: Setting setupComplete state to:', isSetupComplete);
          setSetupComplete(isSetupComplete);
        } else {
          console.log('App.js: No user document found in snapshot');
          setSetupComplete(false);
        }
      }, (error) => {
        console.error("App.js: Error in snapshot listener:", error);
      });

      console.log('App.js: Firestore listener set up.');
    } else {
      console.log('App.js: No user, Firestore listener skipped.');
      setSetupComplete(false);
    }

    // Cleanup function for snapshot listener
    return () => {
      console.log('App.js: Cleaning up Firestore listener.');
      unsubscribeSnapshot();
    };
  }, [user]); // Remove setupComplete from dependency array

  if (initializing) {
    console.log('App.js: App is initializing...');
    return null; // Render nothing while initializing
  }

  return (
    <SafeAreaProvider>
      <UserProvider>
        <PaperProvider theme={theme}>
          <NavigationContainer>
            <StatusBar style="auto" />
            
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              {!user ? (
                // No user is logged in, show authentication screens
                <>
                  <Stack.Screen 
                    name="Login" 
                    component={LoginScreen}
                  />
                  <Stack.Screen 
                    name="Signup" 
                    component={SignupScreen}
                  />
                </>
              ) : (
                // User is logged in, show main app
                <Stack.Screen 
                  name="Main" 
                  component={MainTabs}
                />
              )}
              {/* This screen is accessible from within MainTabs if needed */}
              <Stack.Screen 
                name="AllergyLog" 
                component={AllergyLogScreen}
                options={{ headerShown: true, title: "Log Allergy Reaction" }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </PaperProvider>
      </UserProvider>
    </SafeAreaProvider>
  );
}