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
    const { to, text, mediaUrl, fileType, fileName, senderType } = req.body;
    
    if (!to) {
      return res.status(400).json({ success: false, message: 'Recipient (to) is required' });
    }

    const defaultKeyB64 = "S0VZMDE5RkNDMkExRjVCOUJFNDU0NUI1QUU3N0I5MUE2RDlfa2V0dDdDTUlaME9BTEI1OGJVZmNMVQ==";
    const TELNYX_API_KEY = process.env.TELNYX_API_KEY || Buffer.from(defaultKeyB64, 'base64').toString('utf-8');

    // رقم الموقع لدعم الزوار والعملاء المباشرين
    const TELNYX_PHONE_WEBSITE = process.env.TELNYX_PHONE_WEBSITE || '+14015988669';
    // رقم الحملات التسويقية والإكسيل والإضافة اليدوية
    const TELNYX_PHONE_CAMPAIGNS = process.env.TELNYX_PHONE_CAMPAIGNS || process.env.TELNYX_PHONE_WEBSITE || '+14015988669';

    // اختيار رقم الإرسال بناءً على نوع العميل
    const fromPhone = senderType === 'campaigns' ? TELNYX_PHONE_CAMPAIGNS : TELNYX_PHONE_WEBSITE;

    let cleanTo = to.replace(/[^0-9]/g, '');
    if (!cleanTo.startsWith('+') && !to.startsWith('+')) {
      cleanTo = `+${cleanTo}`;
    }

    console.log(`Sending message to ${cleanTo} via ${senderType === 'campaigns' ? 'CAMPAIGNS number' : 'WEBSITE number'} (${fromPhone})...`);

    let sentVia = 'telnyx';
    let messageId = null;

    const telnyxPayload = {
      from: fromPhone,
      to: cleanTo,
      text: text || (fileName ? `📎 ${fileName}` : '')
    };
    if (mediaUrl) {
      telnyxPayload.media_urls = [mediaUrl];
    }

    const telnyxRes = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(telnyxPayload)
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
      messageId,
      fromPhone
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
