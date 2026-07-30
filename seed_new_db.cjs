const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(
  fs.readFileSync('E:/سوفت وير ومنصه وواتس اب api/etegah-dafe5-firebase-adminsdk-fbsvc-a9494dce90.json', 'utf8')
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function seedDatabase() {
  console.log('=== SEEDING NEW DATABASE (etegah-dafe5) ===');

  // 1. Create or Update Primary Admin Account
  const adminEmail = 'mohamed.gamal.work0@gmail.com';
  const adminPassword = 'Etegah123456$#';
  
  let adminUserRecord;
  try {
    adminUserRecord = await auth.getUserByEmail(adminEmail);
    console.log(`Admin user ${adminEmail} already exists in Auth.`);
    await auth.updateUser(adminUserRecord.uid, { password: adminPassword });
    console.log(`Updated admin password for ${adminEmail}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      adminUserRecord = await auth.createUser({
        email: adminEmail,
        password: adminPassword,
        displayName: 'Etegah Admin',
        emailVerified: true
      });
      console.log(`Created new Admin Auth user: ${adminEmail}`);
    } else {
      throw err;
    }
  }

  // 2. Add Admin to Firestore users collection
  const adminDocData = {
    uid: adminUserRecord.uid,
    name: 'إدارة منصة اتجاه',
    username: 'admin',
    email: adminEmail,
    role: 'Leader',
    jobTitle: 'الإدارة العامة',
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await db.collection('users').doc(adminUserRecord.uid).set(adminDocData, { merge: true });
  console.log(`Saved Admin user doc in Firestore: users/${adminUserRecord.uid}`);

  // 3. Seed Default Employee Accounts
  const employees = [
    { username: 'saed', name: 'سعيد', jobTitle: 'مقدم خدمة عملاء', role: 'Agent' },
    { username: 'sayed', name: 'سيد', jobTitle: 'مقدم خدمة عملاء', role: 'Agent' },
    { username: 'amr', name: 'عمرو كامل', jobTitle: 'مقدم خدمة عملاء', role: 'Agent' }
  ];

  for (const emp of employees) {
    const empEmail = `${emp.username}@etegah.com`;
    const empPassword = 'Etegah123456$#';
    
    let empRecord;
    try {
      empRecord = await auth.getUserByEmail(empEmail);
      await auth.updateUser(empRecord.uid, { password: empPassword });
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        empRecord = await auth.createUser({
          email: empEmail,
          password: empPassword,
          displayName: emp.name,
          emailVerified: true
        });
      } else {
        console.error(`Error with employee ${emp.username}:`, e);
        continue;
      }
    }

    await db.collection('users').doc(empRecord.uid).set({
      uid: empRecord.uid,
      name: emp.name,
      username: emp.username,
      email: empEmail,
      role: emp.role,
      jobTitle: emp.jobTitle,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`Seeded employee account: ${emp.username} (${empEmail})`);
  }

  console.log('=== SEEDING COMPLETED SUCCESSFULLY ===');
}

seedDatabase().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
