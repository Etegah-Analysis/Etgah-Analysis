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
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const twilioSidEnv = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthTokenEnv = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneEnv = process.env.TWILIO_PHONE_NUMBER;
    
    if (twilioSidEnv && twilioAuthTokenEnv && twilioPhoneEnv && dbAdmin) {
      const client = twilio(twilioSidEnv, twilioAuthTokenEnv);
      
      // Generate a 6-digit random code
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // Save to Firestore
      await dbAdmin.collection('otps').doc(phone).set({
        code,
        createdAt: new Date()
      });

      // Send SMS
      await client.messages.create({
        body: `كود التحقق الخاص بك لمنصة اتجاه هو: ${code}`,
        from: twilioPhoneEnv,
        to: phone
      });
        
      console.log(`OTP sent successfully to ${phone} via SMS.`);
      
      res.status(200).json({
        success: true,
        message: 'تم إرسال كود التحقق بنجاح'
      });
    } else {
      console.log(`Simulating OTP send to ${phone} (Twilio/Firebase not fully configured)`);
      res.status(200).json({
        success: true,
        message: 'تم إرسال كود التحقق بنجاح (Simulation)',
        simulated: true
      });
    }
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'فشل إرسال كود التحقق',
      error: error.message
    });
  }
}
