const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

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
const auth = getAuth(app);

async function run() {
  try {
    // Authenticate as Admin
    await signInWithEmailAndPassword(auth, "etegahanalysis@gmail.com", "Etegah123456$#");
    console.log("Logged in as", auth.currentUser.email);
    
    // Fetch users
    const userSnap = await getDocs(collection(db, 'users'));
    console.log("Users fetched successfully:", userSnap.docs.length);
    userSnap.forEach(doc => console.log(doc.id, doc.data().name));
    
    process.exit(0);
  } catch(e) {
    console.error("ERROR FETCHING USERS:", e);
    process.exit(1);
  }
}
run();
