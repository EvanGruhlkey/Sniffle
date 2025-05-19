import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, View, Text, TouchableOpacity, Image,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Animated, Dimensions, Easing
} from 'react-native';
import { TextInput, Button, DefaultTheme } from 'react-native-paper';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

const { width, height } = Dimensions.get('window');

// Define a custom theme for react-native-paper (optional, but good for consistency)
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#00CED1', // Deep Turquoise
    accent: '#40E0D0', // Turquoise - Another shade of turquoise
    background: '#AFEEEE', // PaleTurquoise - A very light turquoise for input backgrounds
    surface: '#FFFFFF', // White for card surfaces
    text: '#333333', // Dark grey for text
    onSurface: '#333333', // Dark grey for text on surface
    onBackground: '#333333', // Dark grey for text on background
    // You might want to adjust other colors like 'error'
  },
};

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Animation values for background elements
  const animatedElements = useRef(
    Array(50).fill(0).map(() => ({
      // Start near a potential 'sneeze origin' off-screen left
      startX: -width * 0.2, 
      startY: height * 0.4 + Math.random() * height * 0.2, // Vertical variation
      endX: width * 1.2, // Move across and off-screen right
      endY: Math.random() * height * 1.2 - height * 0.1, // Random vertical endpoint
      duration: Math.random() * 2000 + 2000, // Duration between 2-4 seconds
      delay: Math.random() * 1000, // Shorter delay for more continuous flow
      size: Math.random() * 15 + 5, // Size between 5-20
      opacity: new Animated.Value(0),
      positionX: new Animated.Value(-width * 0.2),
      positionY: new Animated.Value(height * 0.4 + Math.random() * height * 0.2),
      rotation: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    const animations = animatedElements.map(element => {
      const startAnimation = () => {
        // Reset values
        element.opacity.setValue(0);
        element.positionX.setValue(element.startX);
        element.positionY.setValue(element.startY);
        element.rotation.setValue(0);

        Animated.sequence([
          Animated.delay(element.delay),
          Animated.parallel([
            Animated.timing(element.positionX, {
              toValue: element.endX,
              duration: element.duration,
              useNativeDriver: true,
            }),
            Animated.timing(element.positionY, {
              toValue: element.endY,
              duration: element.duration,
              useNativeDriver: true,
            }),
            Animated.timing(element.opacity, {
              toValue: 0.8,
              duration: element.duration * 0.3,
              useNativeDriver: true,
            }),
            Animated.timing(element.rotation, {
              toValue: 1,
              duration: element.duration,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(element.opacity, {
            toValue: 0,
            duration: element.duration * 0.4,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // When animation completes, start it again
          startAnimation();
        });
      };

      // Start the animation
      startAnimation();

      // Return cleanup function
      return () => {
        element.opacity.stopAnimation();
        element.positionX.stopAnimation();
        element.positionY.stopAnimation();
        element.rotation.stopAnimation();
      };
    });

    // Cleanup function for the entire effect
    return () => {
      animations.forEach(cleanup => cleanup());
    };
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
      // Navigation will be handled automatically by the auth state listener in App.js
    } catch (error) {
      let errorMessage = 'Failed to sign in';
      
      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address format';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled';
          break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          errorMessage = 'Invalid email or password';
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
      {/* Animated Background Elements (Abstract Allergy Particles) */}
      {animatedElements.map((element, index) => (
         <Animated.View
           key={index}
           style={[
             styles.backgroundElement,
             {
               width: element.size,
               height: element.size,
               borderRadius: element.size / 2, // Make them circular or oval-ish based on size
               transform: [
                 { translateX: element.positionX },
                 { translateY: element.positionY },
                 // Scale animation if needed:
                 // { scale: element.scale },
                 { rotate: element.rotation.interpolate({
                     inputRange: [0, 1],
                     outputRange: ['0deg', '360deg'], // Rotate 360 degrees
                   })},
               ],
               opacity: element.opacity,
             },
           ]}
         />
       ))}

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Prominent Logo and Text Section - inspired by new image */}
        <View style={styles.topSectionContainer}>
          <Image 
            source={require('../assets/logo.png')} // Assuming logo.png is generic or will be updated manually
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>Log In To Sniffle</Text>
        </View>
        
        {/* Login Form Section */}
        <View style={styles.formContainer}>
          <TextInput
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            theme={theme} // Apply custom theme
          />
          
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
            theme={theme} // Apply custom theme
          />
          
          <Button 
            mode="contained" 
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.loginButton}
            contentStyle={styles.buttonContent}
            theme={theme} // Apply custom theme
            labelStyle={styles.loginButtonText} // Custom text style
          >
            Log In
          </Button>
          
          {/* Navigation links */}
          <View style={styles.linksContainer}>
            <TouchableOpacity onPress={() => Alert.alert('Coming Soon', 'Forgot Password functionality is not yet implemented.')}>
              <Text style={styles.forgotPasswordLink}>Forgot Password?</Text>
            </TouchableOpacity>

            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Do Not Have Account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#AFEEEE', // PaleTurquoise background color
    position: 'relative', // Needed for absolute positioning of background elements
    overflow: 'hidden', // Hide elements that go outside the container
  },
  // Styles for the animated background elements (Abstract Allergy Particles)
  backgroundElement: {
    position: 'absolute',
    backgroundColor: 'rgba(72, 209, 204, 0.3)', // MediumTurquoise with some transparency
    // borderRadius and size will be set inline based on animation data
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 30, // Increased padding
    justifyContent: 'center', // Center content vertically
    alignItems: 'center', // Center content horizontally
  },
  topSectionContainer: {
    alignItems: 'center',
    marginBottom: 40, // Space between top section and form
  },
  logo: {
    width: 100, // Adjusted logo size
    height: 100,
    marginBottom: 20,
  },
  appName: {
    fontSize: 24, // Adjusted font size
    fontWeight: 'bold',
    color: '#48D1CC', // Using primary theme color
  },
  formContainer: {
    width: '100%',
    maxWidth: 400, // Limit form width on larger screens
    backgroundColor: '#fff', // White background for form
    padding: 20, // Padding inside form container
    borderRadius: 10, // Rounded corners
    elevation: 3, // Subtle shadow
  },
  input: {
    marginBottom: 20, // Increased margin between inputs
    backgroundColor: '#f5f5f5', // Light grey background for inputs
  },
  loginButton: {
    marginTop: 10, // Adjusted margin
    borderRadius: 8, // More rounded button
    paddingVertical: 5, // Increased vertical padding
  },
  loginButtonText: {
    fontSize: 18, // Larger button text
  },
  buttonContent: {
    paddingVertical: 8,
  },
  linksContainer: {
    marginTop: 24, // Space above links
    alignItems: 'center', // Center links horizontally
  },
  forgotPasswordLink: {
    color: '#666',
    fontSize: 15,
    marginBottom: 16,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signupText: {
    color: '#666',
    fontSize: 16,
  },
  signupLink: {
    color: '#48D1CC', // Match primary color
    fontWeight: 'bold',
    fontSize: 16,
  },
});