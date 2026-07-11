import nodemailer from 'nodemailer';
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
    const { email, phone, country, otp } = req.body;
    
    console.log(`Generating OTP for ${email || phone}... OTP: ${otp}`);
    
    let emailSent = false;
    let smsSent = false;
    let previewUrl = null;
    let twilioSid = null;
    
    const fullPhoneNumber = `${country}${phone}`;
    
    // 1. Send Real SMS via Twilio (if credentials exist)
    const twilioSidEnv = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthTokenEnv = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneEnv = process.env.TWILIO_PHONE_NUMBER;
    
    if (twilioSidEnv && twilioAuthTokenEnv && twilioPhoneEnv && phone) {
      try {
        console.log(`Attempting to send real SMS via Twilio to ${fullPhoneNumber}...`);
        const client = twilio(twilioSidEnv, twilioAuthTokenEnv);
        const message = await client.messages.create({
          body: `كود التحقق الخاص بك لمنصة اتجاه هو: ${otp}`,
          from: twilioPhoneEnv,
          to: fullPhoneNumber
        });
        twilioSid = message.sid;
        smsSent = true;
        console.log(`SMS Sent successfully via Twilio! SID: ${twilioSid}`);
      } catch (smsError) {
        console.error('Twilio SMS sending failed:', smsError);
      }
    }
    
    // 2. Send Real/Demo HTML Email
    if (email) {
      const smtpConfig = {
        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      };
      
      if (!smtpConfig.auth.user) {
        const testAccount = await nodemailer.createTestAccount();
        smtpConfig.host = 'smtp.ethereal.email';
        smtpConfig.port = 587;
        smtpConfig.secure = false;
        smtpConfig.auth = {
          user: testAccount.user,
          pass: testAccount.pass
        };
      }
      
      const transporter = nodemailer.createTransport(smtpConfig);
      
      const mailOptions = {
        from: '"منصة اتجاه التحليل الذكي" <no-reply@etegah.com>',
        to: email,
        subject: 'كود التحقق لتأكيد تسجيل الدخول - اتجاه',
        html: `
          <div style="direction: rtl; text-align: right; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background-color: #030f26; color: #ffffff; border-radius: 10px; max-width: 600px; margin: 0 auto; border: 1px solid #00d2ff;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #00d2ff; margin: 0;">منصة اتجاه التحليل الذكي 🎯</h2>
              <p style="color: #8b9eb3; font-size: 0.9rem; margin-top: 5px;">نحو قرارات أدق... برؤية أعمق</p>
            </div>
            <hr style="border: 0; border-top: 1px solid rgba(0, 210, 255, 0.2); margin-bottom: 20px;" />
            <p style="font-size: 1.1rem; line-height: 1.6;">أهلاً بك في منصة اتجاه،</p>
            <p style="font-size: 1rem; line-height: 1.6; color: #8b9eb3;">لقد تلقينا طلباً لتسجيل الدخول أو إنشاء حساب جديد. يرجى استخدام كود التحقق التالي لتأكيد هويتك:</p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="font-size: 2.2rem; font-weight: bold; letter-spacing: 5px; color: #00d2ff; background: rgba(0, 210, 255, 0.1); padding: 15px 35px; border-radius: 8px; border: 1px dashed #00d2ff; display: inline-block;">
                ${otp}
              </span>
            </div>
            <p style="font-size: 0.85rem; color: #8b9eb3; line-height: 1.6; text-align: center;">ينتهي مفعول هذا الكود خلال 5 دقائق. يرجى عدم مشاركة هذا الكود مع أي شخص.</p>
            <hr style="border: 0; border-top: 1px solid rgba(0, 210, 255, 0.2); margin-top: 25px; margin-bottom: 15px;" />
            <p style="font-size: 0.8rem; color: #8b9eb3; text-align: center; margin: 0;">© 2026 منصة اتجاه. جميع الحقوق محفوظة.</p>
          </div>
        `
      };
      
      const info = await transporter.sendMail(mailOptions);
      emailSent = true;
      
      if (smtpConfig.host === 'smtp.ethereal.email') {
        previewUrl = nodemailer.getTestMessageUrl(info);
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'تم إرسال كود التحقق بنجاح',
      emailSent,
      previewUrl,
      smsSent,
      twilioSid,
      phoneSimulated: !smsSent && !!phone,
      simulatedPhoneMessage: !smsSent && phone ? `رسالة SMS تجريبية إلى ${fullPhoneNumber}: كود التحقق الخاص بك لمنصة اتجاه هو ${otp}` : null
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'فشل إرسال كود التحقق',
      error: error.message
    });
  }
}
