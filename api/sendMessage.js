export default async function handler(req, res) {
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
    const { to, text, mediaUrl, fileType, fileName, sendSms } = req.body;
    
    if (!to) {
      return res.status(400).json({ success: false, message: 'Recipient (to) is required' });
    }

    const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
    const TELNYX_PHONE = process.env.TELNYX_PHONE || '+14015988669';

    let cleanTo = to.replace(/[^0-9]/g, '');
    if (!cleanTo.startsWith('+') && !to.startsWith('+')) {
      cleanTo = `+${cleanTo}`;
    }

    console.log(`Sending message to ${cleanTo}...`);

    let sentVia = 'telnyx';
    let messageId = null;

    const telnyxRes = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: TELNYX_PHONE,
        to: cleanTo,
        text: text || ''
      })
    });
    const telnyxData = await telnyxRes.json();
    if (telnyxRes.ok) {
      sentVia = 'telnyx_sms';
      messageId = telnyxData.data?.id;
    }

    res.status(200).json({
      success: true,
      message: 'تم إرسال الرسالة بنجاح',
      sentVia,
      messageId
    });
  } catch (error) {
    console.error('Error in sendMessage:', error);
    res.status(500).json({
      success: false,
      message: 'فشل إرسال الرسالة',
      error: error.message
    });
  }
}
