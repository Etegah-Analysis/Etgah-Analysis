import twilio from 'twilio';
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
    const { phone, code } = req.body;
    
    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Phone number and code are required' });
    }

    if (dbAdmin) {
      const docRef = dbAdmin.collection('otps').doc(phone);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        const data = docSnap.data();
        
        // Check if code matches
        if (data.code === code) {
          // Verify code hasn't expired (e.g. 10 minutes)
          const now = new Date().getTime();
          const createdAt = data.createdAt.toDate().getTime();
          const diffMinutes = (now - createdAt) / 1000 / 60;

          if (diffMinutes <= 10) {
            // Delete the OTP document so it can't be used again
            await docRef.delete();
            
            return res.status(200).json({
              success: true,
              message: 'تم التحقق بنجاح'
            });
          } else {
            return res.status(400).json({
              success: false,
              message: 'الكود منتهي الصلاحية'
            });
          }
        }
      }
      
      // If we reach here, either doc doesn't exist or code is wrong
      return res.status(400).json({
        success: false,
        message: 'الكود غير صحيح'
      });
      
    } else {
      console.log(`Simulating OTP verification for ${phone} with code ${code}`);
      if (code === '123456') { // Simulation successful code
        res.status(200).json({
          success: true,
          message: 'تم التحقق بنجاح (Simulation)',
          simulated: true
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'الكود غير صحيح (للتجربة استخدم 123456)',
          simulated: true
        });
      }
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({
      success: false,
      message: 'فشل التحقق من الكود',
      error: error.message
    });
  }
}
