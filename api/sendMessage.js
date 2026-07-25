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
    const { to, text, mediaUrl } = req.body;
    
    console.log(`Attempting to send message to ${to}...`);
    
    let twilioSid = null;
    let smsSent = false;
    
    const twilioSidEnv = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthTokenEnv = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneEnv = process.env.TWILIO_PHONE_NUMBER; // Must be Twilio WhatsApp Sandbox or approved sender (e.g., whatsapp:+14155238886)
    
    if (twilioSidEnv && twilioAuthTokenEnv && twilioPhoneEnv && to) {
      try {
        const client = twilio(twilioSidEnv, twilioAuthTokenEnv);
        
        // Ensure format is whatsapp:phoneNumber
        const fromNumber = twilioPhoneEnv.startsWith('whatsapp:') ? twilioPhoneEnv : `whatsapp:${twilioPhoneEnv}`;
        let toNumber = to;
        // Strip plus if any, and ensure it starts with whatsapp:
        if (!toNumber.startsWith('whatsapp:')) {
          if (toNumber.startsWith('+')) {
            toNumber = `whatsapp:${toNumber}`;
          } else {
            toNumber = `whatsapp:+${toNumber}`;
          }
        }

        const messagePayload = {
          body: text || '',
          from: fromNumber,
          to: toNumber
        };

        if (mediaUrl) {
          messagePayload.mediaUrl = [mediaUrl];
        }

        const message = await client.messages.create(messagePayload);
        twilioSid = message.sid;
        smsSent = true;
        console.log(`WhatsApp Message Sent successfully via Twilio! SID: ${twilioSid}`);
      } catch (smsError) {
        console.error('Twilio WhatsApp sending failed:', smsError);
        return res.status(500).json({
          success: false,
          message: 'Twilio WhatsApp sending failed',
          error: smsError.message
        });
      }
    } else {
      console.log(`Simulating message to ${to}: ${text} ${mediaUrl ? `[Media: ${mediaUrl}]` : ''}`);
    }
    
    res.status(200).json({
      success: true,
      message: 'تم إرسال الرسالة بنجاح',
      smsSent,
      twilioSid,
      simulated: !smsSent
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'فشل إرسال الرسالة',
      error: error.message
    });
  }
}
