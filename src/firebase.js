// firebase.js
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  createUserWithEmailAndPassword, // New: for user registration
  signInWithEmailAndPassword,   // New: for user login
  signOut                     // New: for user logout
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Define firebaseConfig using environment variables, which are typically loaded by Vite
// and exposed via import.meta.env in a development or build environment.
// Ensure these environment variables are set in your Netlify project settings.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  // measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// __app_id is a global variable provided by the Canvas environment for pathing within Firestore.
// It helps segregate data for different apps hosted in the same environment.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

// Export the initialized Firebase instances and utility functions for use throughout your app.
export {
  app,
  auth,
  db,
  appId,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
};

