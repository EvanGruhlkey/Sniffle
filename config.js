// App configuration

// Import environment variables
import { 
  API_URL as ENV_API_URL,
  FIREBASE_API_KEY as ENV_FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN as ENV_FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID as ENV_FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET as ENV_FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID as ENV_FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID as ENV_FIREBASE_APP_ID,
  FIREBASE_MEASUREMENT_ID as ENV_FIREBASE_MEASUREMENT_ID,
} from '@env';

// API URL - prefer env, fallback to Android emulator localhost
export const API_URL = ENV_API_URL || 'http://10.0.2.2:5000';

// Firebase configuration
export const FIREBASE_CONFIG = {
  apiKey: ENV_FIREBASE_API_KEY,
  authDomain: ENV_FIREBASE_AUTH_DOMAIN,
  projectId: ENV_FIREBASE_PROJECT_ID,
  storageBucket: ENV_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: ENV_FIREBASE_MESSAGING_SENDER_ID,
  appId: ENV_FIREBASE_APP_ID,
  measurementId: ENV_FIREBASE_MEASUREMENT_ID,
  // Add these for React Native Firebase
  
};

// App settings
export const APP_SETTINGS = {
  version: '1.0.0',
  supportEmail: 'support@sniffle.com',
  privacyPolicyUrl: 'https://sniffle.example.com/privacy', // You might want to make this an env var too
  termsOfServiceUrl: 'https://sniffle.example.com/terms' // You might want to make this an env var too
};