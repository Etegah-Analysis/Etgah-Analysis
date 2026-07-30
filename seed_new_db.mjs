import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(
  fs.readFileSync('E:/سوفت وير ومنصه وواتس اب api/etegah-dafe5-firebase-adminsdk-fbsvc-a9494dce90.json', 'utf8')
);

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

async function seedFirestoreOnly() {
  console.log('=== SEEDING FIRESTORE DOCUMENTS (etegah-dafe5) ===');

  const adminEmail = 'mohamed.gamal.work0@gmail.com';
  const adminDocData = {
    uid: 'admin_primary_uid',
    name: 'إدارة منصة اتجاه',
    username: 'admin',
    email: adminEmail,
    role: 'Leader',
    jobTitle: 'الإدارة العامة',
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  await db.collection('users').doc('admin_primary_uid').set(adminDocData, { merge: true });
  console.log(`Saved Admin user doc in Firestore: users/admin_primary_uid`);

  const employees = [
    { id: 'emp_saed', username: 'saed', name: 'سعيد', jobTitle: 'مقدم خدمة عملاء', role: 'Agent', email: 'saed@etegah.com' },
    { id: 'emp_sayed', username: 'sayed', name: 'سيد', jobTitle: 'مقدم خدمة عملاء', role: 'Agent', email: 'sayed@etegah.com' },
    { id: 'emp_amr', username: 'amr', name: 'عمرو كامل', jobTitle: 'مقدم خدمة عملاء', role: 'Agent', email: 'amrkamel@etegah.com' }
  ];

  for (const emp of employees) {
    await db.collection('users').doc(emp.id).set({
      uid: emp.id,
      name: emp.name,
      username: emp.username,
      email: emp.email,
      role: emp.role,
      jobTitle: emp.jobTitle,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`Seeded employee doc: ${emp.username}`);
  }

  console.log('=== FIRESTORE SEEDING COMPLETED SUCCESSFULLY ===');
}

seedFirestoreOnly().catch(err => {
  console.error('Firestore seeding error:', err);
  process.exit(1);
});
