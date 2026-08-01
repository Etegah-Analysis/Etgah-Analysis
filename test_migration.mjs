import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// 1. Initialize Old Firebase App (etegah)
const oldServiceAccount = JSON.parse(
  fs.readFileSync('E:/سوفت وير ومنصه وواتس اب api/etegah-firebase-adminsdk-fbsvc-efa2c458ca.json', 'utf8')
);

const oldApp = initializeApp({
  credential: cert(oldServiceAccount)
}, 'oldApp');

const oldDb = getFirestore(oldApp);

// 2. Initialize New Firebase App (etegah-dafe5)
const newServiceAccount = JSON.parse(
  fs.readFileSync('E:/سوفت وير ومنصه وواتس اب api/etegah-dafe5-firebase-adminsdk-fbsvc-a9494dce90.json', 'utf8')
);

const newApp = initializeApp({
  credential: cert(newServiceAccount)
}, 'newApp');

const newDb = getFirestore(newApp);

async function testConnection() {
  console.log('=== TESTING CONNECTION TO OLD AND NEW FIRESTORE ===');
  
  // List collections in old db
  const oldCollections = await oldDb.listCollections();
  console.log('Old Database Collections:', oldCollections.map(c => c.id));

  // List collections in new db
  const newCollections = await newDb.listCollections();
  console.log('New Database Collections:', newCollections.map(c => c.id));
}

testConnection().catch(console.error);
