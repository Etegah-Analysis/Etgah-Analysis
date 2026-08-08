import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, where, updateDoc, setDoc, getDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBKb_V-mc6_T8Ik33Lcwe18hxTdK6M7UXo",
  authDomain: "etegah-dafe5.firebaseapp.com",
  projectId: "etegah-dafe5",
  storageBucket: "etegah-dafe5.firebasestorage.app",
  messagingSenderId: "754580123107",
  appId: "1:754580123107:web:20a5454b787fa0965d84d6"
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
