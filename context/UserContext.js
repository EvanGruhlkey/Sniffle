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
    let unsubscribeUserSnapshot = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      console.log('UserContext: Auth state changed. User:', user ? user.uid : 'null');

      // Clean up previous snapshot if any when auth state changes
      if (unsubscribeUserSnapshot) {
        console.log('UserContext: Cleaning up previous Firestore listener');
        unsubscribeUserSnapshot();
        unsubscribeUserSnapshot = null;
      }

      if (user) {
        try {
          const userRef = doc(firestore, 'users', user.uid);
          console.log('UserContext: Setting up Firestore listener for user:', user.uid);

          unsubscribeUserSnapshot = onSnapshot(userRef, (docSnap) => {
            console.log('UserContext: Firestore snapshot received');
            if (docSnap.exists()) {
              const data = docSnap.data();
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
      unsubscribeAuth();
      if (unsubscribeUserSnapshot) {
        console.log('UserContext: Cleaning up Firestore listener');
        unsubscribeUserSnapshot();
      }
    };
  }, []);

  return (
    <UserContext.Provider value={{ userData, setUserData, loading }}>
      {children}
    </UserContext.Provider>
  );
};