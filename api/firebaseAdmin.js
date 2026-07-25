import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    // We expect FIREBASE_SERVICE_ACCOUNT to be a JSON string of the service account key
    // Set this up in Vercel Environment Variables
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (serviceAccountKey) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccountKey))
      });
      console.log('Firebase Admin Initialized successfully.');
    } else {
      console.warn('FIREBASE_SERVICE_ACCOUNT environment variable is missing.');
    }
  } catch (error) {
    console.error('Firebase admin initialization error', error.stack);
  }
}

export const dbAdmin = admin.apps.length ? admin.firestore() : null;
export default admin;
