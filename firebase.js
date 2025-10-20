// firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { FIREBASE_CONFIG } from './config';

// Initialize Firebase
// Use getApps() to check if an app instance already exists
const app = !getApps().length ? initializeApp(FIREBASE_CONFIG) : getApp();

// Get auth instance - let Firebase handle the initialization
const auth = getAuth(app);

const firestore = getFirestore(app);

export { app, auth, firestore };