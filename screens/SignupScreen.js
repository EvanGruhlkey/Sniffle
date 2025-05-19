import React, { useState } from 'react';
import { 
  StyleSheet, View, Text, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, Alert
} from 'react-native';
import { TextInput, Button, DefaultTheme } from 'react-native-paper';
import { auth, firestore } from '../firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Define a custom theme for react-native-paper (optional, but good for consistency)
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#00CED1', // Deep Turquoise
    accent: '#40E0D0', // Turquoise
    background: '#AFEEEE', // PaleTurquoise
    surface: '#FFFFFF',
    text: '#333333',
    onSurface: '#333333',
    onBackground: '#333333',
  },
};

export default function SignupScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    // Validate inputs
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      
      // Create user with Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Update user profile with display name
      await updateProfile(user, {
        displayName: name,
      });
      
      // Create user document in Firestore
      await setDoc(doc(firestore, 'users', user.uid), {
        name: name,
        email: email,
        allergens: [],
        severity_history: [],
        food_logs: [],
        setupComplete: false,
        created_at: serverTimestamp(),
      });
      
      // Navigation will be handled automatically by the auth state listener in App.js
    } catch (error) {
      let errorMessage = 'Failed to create account';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Email address is already in use';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address format';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak';
          break;
        default:
          errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Create Sniffle Account</Text>
        <Text style={styles.subtitle}>Sign up to track and understand your allergies</Text>
        
        <View style={styles.formContainer}>
          <TextInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={styles.input}
            theme={theme}
          />
          
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            theme={theme}
          />
          
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
            theme={theme}
          />
          
          <TextInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
            theme={theme}
          />
          
          <Button 
            mode="contained" 
            onPress={handleSignup}
            loading={loading}
            disabled={loading}
            style={styles.signupButton}
            contentStyle={styles.buttonContent}
            theme={theme}
            labelStyle={styles.signupButtonText}
          >
            Create Account
          </Button>
          
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#AFEEEE', // PaleTurquoise background
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 30,
    paddingTop: 50,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#555',
    marginBottom: 30,
  },
  formContainer: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    elevation: 3,
  },
  input: {
    marginBottom: 20,
    backgroundColor: '#f5f5f5',
  },
  signupButton: {
    marginTop: 10,
    borderRadius: 8,
    paddingVertical: 5,
  },
  signupButtonText: {
    fontSize: 18,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
  loginText: {
    color: '#666',
    fontSize: 16,
  },
  loginLink: {
    color: '#48D1CC', // MediumTurquoise
    fontWeight: 'bold',
    fontSize: 16,
  },
});