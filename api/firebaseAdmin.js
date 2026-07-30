import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

try {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (serviceAccountKey) {
    if (!getApps().length) {
      initializeApp({
        credential: cert(JSON.parse(serviceAccountKey)),
        storageBucket: "etegah.firebasestorage.app"
      });
      console.log('Firebase Admin Initialized successfully.');
    }
  } else {
    console.warn('FIREBASE_SERVICE_ACCOUNT environment variable is missing.');
  }
} catch (error) {
  console.error('Firebase admin initialization error', error.stack);
}

export const dbAdmin = getApps().length ? getFirestore() : null;
export const storageAdmin = getApps().length ? getStorage() : null;
