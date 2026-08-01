import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const oldConfig = {
  apiKey: "AIzaSyAs39uG2HkGiEvdwemeVKCCExFM7VqkFwQ",
  authDomain: "etegah.firebaseapp.com",
  projectId: "etegah",
  storageBucket: "etegah.appspot.com",
  messagingSenderId: "488142699033",
  appId: "1:488142699033:web:0419243d5b2e0f4f388888",
  measurementId: "G-GHFS51Z1J7"
};

const app = initializeApp(oldConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function testRead() {
  console.log("=== ATTEMPTING CLIENT AUTH ON OLD ETEGAH PROJECT ===");
  try {
    const cred = await signInWithEmailAndPassword(auth, "etegahanalysis@gmail.com", "123456");
    console.log("SUCCESSFULLY LOGGED IN TO OLD PROJECT!", cred.user.email, cred.user.uid);
  } catch (err) {
    console.error("Auth login failed:", err.message);
  }

  // Known collection names in the old project
  const knownCollections = [
    'users',
    'بيانات_تسجيل_العملاء',
    'visitor_customers',
    'recycle_bin',
    'رسائل_الموظفين_للعملاء',
    'رسائل_الموظفين',
    'whatsapp_messages',
    'us_market',
    'saudi_market',
    'market_data',
    'chats',
    'messages',
    'templates'
  ];

  console.log("\n=== CHECKING COLLECTIONS IN OLD DATABASE ===");
  for (const colName of knownCollections) {
    try {
      const snap = await getDocs(collection(db, colName));
      console.log(`Collection '${colName}': ${snap.docs.length} documents found`);
    } catch (e) {
      console.log(`Collection '${colName}': error reading (${e.message})`);
    }
  }
}

testRead().catch(console.error);
