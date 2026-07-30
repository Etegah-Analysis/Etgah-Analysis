import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
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

const auth = getAuth();
const db = getFirestore();

async function seedEverything() {
  console.log('=== STARTING FULL AUTH & FIRESTORE SEEDING (etegah-dafe5) ===');

  // 1. Primary Admin Account
  const adminEmail = 'mohamed.gamal.work0@gmail.com';
  const adminPassword = 'Etegah123456$#';
  
  let adminRecord;
  try {
    adminRecord = await auth.getUserByEmail(adminEmail);
    console.log(`[AUTH] Admin user ${adminEmail} already exists. Updating password...`);
    await auth.updateUser(adminRecord.uid, { password: adminPassword });
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      adminRecord = await auth.createUser({
        email: adminEmail,
        password: adminPassword,
        displayName: 'Etegah Admin',
        emailVerified: true
      });
      console.log(`[AUTH] Created Admin user: ${adminEmail}`);
    } else {
      throw err;
    }
  }

  await db.collection('users').doc(adminRecord.uid).set({
    uid: adminRecord.uid,
    name: 'إدارة منصة اتجاه',
    username: 'admin',
    email: adminEmail,
    role: 'Leader',
    jobTitle: 'الإدارة العامة',
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  console.log(`[FIRESTORE] Admin doc created at users/${adminRecord.uid}`);

  // 2. Default Employees
  const employees = [
    { username: 'saed', name: 'سعيد', jobTitle: 'مقدم خدمة عملاء', role: 'Agent', email: 'saed@etegah.com' },
    { username: 'sayed', name: 'سيد', jobTitle: 'مقدم خدمة عملاء', role: 'Agent', email: 'sayed@etegah.com' },
    { username: 'amr', name: 'عمرو كامل', jobTitle: 'مقدم خدمة عملاء', role: 'Agent', email: 'amrkamel@etegah.com' }
  ];

  for (const emp of employees) {
    const empPassword = 'Etegah123456$#';
    let empRecord;
    try {
      empRecord = await auth.getUserByEmail(emp.email);
      await auth.updateUser(empRecord.uid, { password: empPassword });
      console.log(`[AUTH] Updated employee Auth: ${emp.username}`);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        empRecord = await auth.createUser({
          email: emp.email,
          password: empPassword,
          displayName: emp.name,
          emailVerified: true
        });
        console.log(`[AUTH] Created employee Auth: ${emp.username}`);
      } else {
        console.error(`Error with ${emp.username}:`, e);
        continue;
      }
    }

    await db.collection('users').doc(empRecord.uid).set({
      uid: empRecord.uid,
      name: emp.name,
      username: emp.username,
      email: emp.email,
      role: emp.role,
      jobTitle: emp.jobTitle,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`[FIRESTORE] Employee doc created: users/${empRecord.uid}`);
  }

  console.log('=== FULL SEEDING COMPLETED SUCCESSFULLY 100% ===');
}

seedEverything().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
