// src/lib/firebase.js
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyCoz3h5uVlWHr_o4vNgaAfpUXkRYPLkRL0",
  authDomain: "rakibdz.firebaseapp.com",
  projectId: "rakibdz",
  storageBucket: "rakibdz.firebasestorage.app",
  messagingSenderId: "1062258723240",
  appId: "1:1062258723240:web:9de73ce8427b294304359d",
  measurementId: "G-S0ZM4R89HC"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export default app;