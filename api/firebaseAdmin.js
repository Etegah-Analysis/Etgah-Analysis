import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

try {
  let saKey = null;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      saKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (e) {
      console.error('Error parsing FIREBASE_SERVICE_ACCOUNT env:', e);
    }
  }

  if (saKey && !getApps().length) {
    initializeApp({
      credential: cert(saKey),
      storageBucket: "etegah-dafe5.appspot.com"
    });
    console.log('Firebase Admin Initialized successfully.');
  }
} catch (error) {
  console.error('Firebase admin initialization error', error.stack);
}

export const dbAdmin = getApps().length ? getFirestore() : null;
export const storageAdmin = getApps().length ? getStorage() : null;
