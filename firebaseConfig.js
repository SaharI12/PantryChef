import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // <--- 1. Import Auth

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBOTWDvsEJWzbTsMRvkDOT1ABZbHFm31-c",
  authDomain: "smartkitchen-a2d1f.firebaseapp.com",
  projectId: "smartkitchen-a2d1f",
  storageBucket: "smartkitchen-a2d1f.firebasestorage.app",
  messagingSenderId: "393518767915",
  appId: "1:393518767915:web:ae6146ae1a4dd7d8ecef6e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const db = getFirestore(app);
export const auth = getAuth(app); // <--- 2. Export Auth