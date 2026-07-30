const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
  apiKey: "AIzaSyBKb_V-mc6_T8Ik33Lcwe18hxTdK6M7UXo",
  authDomain: "etegah-dafe5.firebaseapp.com",
  projectId: "etegah-dafe5",
  storageBucket: "etegah-dafe5.firebasestorage.app",
  messagingSenderId: "754580123107",
  appId: "1:754580123107:web:20a5454b787fa0965d84d6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function testAuth() {
  console.log('Testing client auth for mohamed.gamal.work0@gmail.com with new API key...');
  try {
    const cred = await signInWithEmailAndPassword(auth, 'mohamed.gamal.work0@gmail.com', '123456');
    console.log('🎉 SUCCESS! Admin logged in successfully!');
    console.log('Email:', cred.user.email);
    console.log('UID:', cred.user.uid);
  } catch (err) {
    console.error('FAILED with code:', err.code, err.message);
  }
}

testAuth();
