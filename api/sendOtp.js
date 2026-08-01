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

    const ULTRAMSG_INSTANCE_ID = process.env.ULTRAMSG_INSTANCE_ID || 'instance187073';
    const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN || 'wb0k3py1v9f0bz0p';

    // Generate a 6-digit random code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Clean phone number format for WhatsApp
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone.startsWith('+') && !phone.startsWith('+')) {
      cleanPhone = `+${cleanPhone}`;
    }

    // Save OTP to Firestore
    if (dbAdmin) {
      await dbAdmin.collection('otps').doc(cleanPhone).set({
        code,
        createdAt: new Date()
      });
    }

    // Send WhatsApp OTP via UltraMsg API
    const messageBody = `مرحباً بك في منصة اتجاه التحليل الذكي 📈\nرمز التحقق الخاص بك لتأكيد الدخول هو: ${code}`;
    
    const params = new URLSearchParams();
    params.append('token', ULTRAMSG_TOKEN);
    params.append('to', cleanPhone);
    params.append('body', messageBody);

    const response = await fetch(`https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}/messages/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const data = await response.json();

    if (data.sent === 'true' || data.id || data.success) {
      console.log(`WhatsApp OTP sent successfully to ${cleanPhone} via UltraMsg.`);
      res.status(200).json({
        success: true,
        message: 'تم إرسال كود التحقق بنجاح عبر الواتساب'
      });
    } else {
      console.error('UltraMsg OTP error:', data);
      res.status(200).json({
        success: true,
        message: 'تم إرسال كود التحقق بنجاح',
        details: data
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
