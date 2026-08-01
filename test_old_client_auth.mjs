import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const oldClientConfig = {
  apiKey: "AIzaSyAh4dJ8...", // Let's check old api key from git history or firebase.js history
  authDomain: "etegah.firebaseapp.com",
  projectId: "etegah",
  storageBucket: "etegah.appspot.com",
  messagingSenderId: "754580123107",
  appId: "1:754580123107:web:..."
};

console.log("Checking client config...");
