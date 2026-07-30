import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
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

async function setPasswords() {
  const accounts = [
    { email: 'mohamed.gamal.work0@gmail.com', pass: '123456' },
    { email: 'saed@etegah.com', pass: '123456' },
    { email: 'sayed@etegah.com', pass: '123456' },
    { email: 'amrkamel@etegah.com', pass: '123456' }
  ];

  for (const acc of accounts) {
    try {
      const user = await auth.getUserByEmail(acc.email);
      await auth.updateUser(user.uid, { password: acc.pass });
      console.log(`Updated password for ${acc.email} to '${acc.pass}'`);
    } catch (e) {
      console.error(`Error updating ${acc.email}:`, e.message);
    }
  }
}

setPasswords();
