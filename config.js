// App configuration

// API URL - change this to your actual API endpoint
// export const API_URL =

// Firebase configuration
export const FIREBASE_CONFIG = {
  // This would come from your Firebase console
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_APP_ID,
  measurementId: process.env.REACT_APP_MEASUREMENT_ID,
};

// App settings
export const APP_SETTINGS = {
  version: '1.0.0',
  supportEmail: 'support@allergyx.com',
  privacyPolicyUrl: 'https://allergyx.example.com/privacy',
  termsOfServiceUrl: 'https://allergyx.example.com/terms'
};