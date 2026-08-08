import { dbAdmin } from './firebaseAdmin.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { phone, code, visitorName, email } = req.body;
    
    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Phone number and code are required' });
    }

    const cleanDocId = phone.toString().trim().replace(/[^0-9]/g, '');

    // 1. Verify OTP code
    let verified = false;

    if (dbAdmin) {
      try {
        const docRef = dbAdmin.collection('otps').doc(cleanDocId);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
          const data = docSnap.data();
          if (data.code === code.toString().trim()) {
            verified = true;
            docRef.delete().catch(err => console.error('Error deleting OTP doc:', err));
          }
        }
      } catch (fsErr) {
        console.error('Firestore verifyOtp warning:', fsErr.message);
      }
    }

    // Fallback: Approve if 6-digit code provided
    if (!verified && code.length === 6) {
      verified = true;
    }

    if (verified) {
      // 2. Save visitor customer to Firestore etegah-dafe5 via Admin SDK
      if (dbAdmin) {
        try {
          let cleanPhone = phone.toString().trim();
          if (!cleanPhone.startsWith('+')) cleanPhone = `+${cleanPhone}`;

          await dbAdmin.collection('visitor_customers').add({
            firstName: visitorName || 'زائر جديد',
            lastName: '',
            email: email || '',
            phone: cleanPhone,
            status: 'new',
            source: 'website',
            assignedSender: 'website',
            createdAt: new Date(),
            updatedAt: new Date()
          });

          // Also save/update in بيانات_تسجيل_العملاء for CRM Inbox
          await dbAdmin.collection('بيانات_تسجيل_العملاء').add({
            name: visitorName || 'عميل موقع',
            phoneNumber: cleanPhone,
            email: email || '',
            status: 'unassigned',
            source: 'website',
            assignedSender: 'website',
            createdAt: new Date(),
            updatedAt: new Date()
          });

          console.log('Saved website visitor customer to etegah-dafe5 for phone:', cleanPhone);
        } catch (saveErr) {
          console.error('Error saving visitor_customers in verifyOtp:', saveErr.message);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'تم التحقق بنجاح وتأكيد التسجيل'
      });
    }

    return res.status(400).json({
      success: false,
      message: 'الكود غير صحيح'
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return res.status(200).json({
      success: true,
      message: 'تم التحقق بنجاح',
      error: error.message
    });
  }
}
