import twilio from 'twilio';

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

    const twilioSidEnv = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthTokenEnv = process.env.TWILIO_AUTH_TOKEN;
    const twilioVerifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    
    if (twilioSidEnv && twilioAuthTokenEnv && twilioVerifyServiceSid) {
      const client = twilio(twilioSidEnv, twilioAuthTokenEnv);
      
      const verificationCheck = await client.verify.v2.services(twilioVerifyServiceSid)
        .verificationChecks
        .create({ to: phone, code: code });
        
      console.log(`OTP Verification check for ${phone}. Status: ${verificationCheck.status}`);
      
      if (verificationCheck.status === 'approved') {
        res.status(200).json({
          success: true,
          message: 'تم التحقق بنجاح'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'الكود غير صحيح أو منتهي الصلاحية'
        });
      }
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
