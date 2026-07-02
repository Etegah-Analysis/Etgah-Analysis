import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, where, updateDoc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

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

export { db, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, where, updateDoc, setDoc, getDoc, serverTimestamp };
