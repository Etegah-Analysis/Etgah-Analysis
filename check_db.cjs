const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

// Since we know the config from firebase.js, I will hardcode it here.
const firebaseConfig = {
  apiKey: "AIzaSyAs39uG2HkGiEvdwemeVKCCExFM7VqkFwQ",
  authDomain: "etegah.firebaseapp.com",
  projectId: "etegah",
  storageBucket: "etegah.appspot.com",
  messagingSenderId: "488142699033",
  appId: "1:488142699033:web:0419243d5b2e0f4f388888",
  measurementId: "G-GHFS51Z1J7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  try {
    const rbSnap = await getDocs(collection(db, 'recycle_bin'));
    console.log('Recycle Bin items:');
    rbSnap.forEach(d => console.log(d.id, d.data()));
    
    const userSnap = await getDocs(collection(db, 'users'));
    console.log('Users items:');
    userSnap.forEach(d => console.log(d.id, d.data()));
    
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
run();
