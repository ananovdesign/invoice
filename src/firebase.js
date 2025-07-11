import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Define firebaseConfig using import.meta.env variables.
// These variables MUST be set in Netlify with the VITE_FIREBASE_ prefix.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID // Optional, if you enabled Analytics
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

// Export the initialized Firebase Instances and utility functions for use throughout your app.
export {
  app,
  auth,
  db,
  createUserWithEmailAndPassword, // For new user registration
  signInWithEmailAndPassword,     // For user login
  onAuthStateChanged,             // For listening to auth state changes
  signOut                         // For user logout
};
