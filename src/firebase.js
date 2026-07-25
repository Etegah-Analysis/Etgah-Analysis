import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, where, updateDoc, setDoc, getDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAs39uG2HkGiEvdwemeVKCCExFM7VqkFwQ",
  authDomain: "etegah.firebaseapp.com",
  projectId: "etegah",
  storageBucket: "etegah.firebasestorage.app",
  messagingSenderId: "488142699033",
  appId: "1:488142699033:web:0419243d5b2e0f4f388888",
  measurementId: "G-GHFS51Z1J7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Secondary App for Admin to create users without auto-login
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

export { 
  db, 
  auth, 
  storage,
  secondaryAuth,
  createUserWithEmailAndPassword,
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  deleteDoc, 
  doc, 
  where, 
  updateDoc, 
  setDoc, 
  getDoc, 
  serverTimestamp,
  onSnapshot,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};
