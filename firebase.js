// firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc } from 'firebase/firestore';
import { FIREBASE_CONFIG } from './config';

// Initialize Firebase
// Use getApps() to check if an app instance already exists
const app = !getApps().length ? initializeApp(FIREBASE_CONFIG) : getApp();

const auth = getAuth(app);
const firestore = getFirestore(app);

// You might still need a config object, but it's often passed differently
// with React Native Firebase depending on your setup (e.g., google-services.json/GoogleService-Info.plist)
// For now, let's keep the structure but note this might need adjustment
// depending on your specific RN Firebase initialization.

// It's common to initialize in your App.js or similar entry point
// when using the modular RN Firebase approach.
// For now, we'll export the initialized instances.

export { app, auth, firestore };

// If you were using web-specific functions like getAuth, getFirestore, etc.
// in other files, you'll now import those directly from @react-native-firebase/auth
// or @react-native-firebase/firestore, or use the methods available on the auth and firestore instances.