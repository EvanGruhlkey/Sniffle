import React, { createContext, useState, useEffect } from 'react';
import { auth, firestore } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// Create the context
export const UserContext = createContext();

// Provider component
export const UserProvider = ({ children }) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('UserContext: Setting up auth state listener');
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('UserContext: Auth state changed. User:', user ? user.uid : 'null');
      if (user) {
        try {
          // Set up real-time listener for user data
          const userRef = doc(firestore, 'users', user.uid);
          console.log('UserContext: Setting up Firestore listener for user:', user.uid);
          
          const unsubscribeSnapshot = onSnapshot(userRef, (doc) => {
            console.log('UserContext: Firestore snapshot received');
            if (doc.exists()) {
              const data = doc.data();
              console.log('UserContext: User data received:', data);
              setUserData(data);
            } else {
              console.log('UserContext: No user document found');
              setUserData(null);
            }
            setLoading(false);
          }, (error) => {
            console.error('UserContext: Error in user data listener:', error);
            setLoading(false);
          });

          return () => {
            console.log('UserContext: Cleaning up Firestore listener');
            unsubscribeSnapshot();
          };
        } catch (error) {
          console.error('UserContext: Error setting up user data listener:', error);
          setLoading(false);
        }
      } else {
        console.log('UserContext: No user, clearing user data');
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      console.log('UserContext: Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  return (
    <UserContext.Provider value={{ userData, setUserData, loading }}>
      {children}
    </UserContext.Provider>
  );
};