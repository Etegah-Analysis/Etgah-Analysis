import { dbAdmin } from './api/firebaseAdmin.js';

async function testAddVisitor() {
  if (!dbAdmin) {
    console.error('dbAdmin not initialized!');
    return;
  }

  try {
    const res = await dbAdmin.collection('visitor_customers').add({
      firstName: 'تجربة زائر جديد',
      lastName: '',
      email: 'test@etegah.com',
      phone: '+201114934567',
      status: 'new',
      createdAt: new Date()
    });
    console.log('Successfully added visitor customer to etegah-dafe5! Doc ID:', res.id);
  } catch (err) {
    console.error('Error adding doc:', err);
  }
}

testAddVisitor();
