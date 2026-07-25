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
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const twilioSidEnv = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthTokenEnv = process.env.TWILIO_AUTH_TOKEN;
    const twilioVerifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    
    if (twilioSidEnv && twilioAuthTokenEnv && twilioVerifyServiceSid) {
      const client = twilio(twilioSidEnv, twilioAuthTokenEnv);
      
      const verification = await client.verify.v2.services(twilioVerifyServiceSid)
        .verifications
        .create({ to: phone, channel: 'sms' });
        
      console.log(`OTP sent successfully to ${phone}. Status: ${verification.status}`);
      
      res.status(200).json({
        success: true,
        message: 'تم إرسال كود التحقق بنجاح',
        status: verification.status
      });
    } else {
      console.log(`Simulating OTP send to ${phone} (Twilio credentials not fully configured)`);
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
