// App configuration

// Import environment variables
import { 
  API_URL,
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
  FIREBASE_MEASUREMENT_ID,
} from '@env';

// API URL - change this to your actual API endpoint
//export const API_URL = API_URL;

// Firebase configuration
export const FIREBASE_CONFIG = {
  apiKey: FIREBASE_API_KEY,
  authDomain: FIREBASE_AUTH_DOMAIN,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  appId: FIREBASE_APP_ID,
  measurementId: FIREBASE_MEASUREMENT_ID,
  // Add these for React Native Firebase
  
};

// App settings
export const APP_SETTINGS = {
  version: '1.0.0',
  supportEmail: 'support@sniffle.com',
  privacyPolicyUrl: 'https://sniffle.example.com/privacy', // You might want to make this an env var too
  termsOfServiceUrl: 'https://sniffle.example.com/terms' // You might want to make this an env var too
};