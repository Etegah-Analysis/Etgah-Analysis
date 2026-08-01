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
    const { to, text, mediaUrl, fileType, fileName } = req.body;
    
    if (!to) {
      return res.status(400).json({ success: false, message: 'Recipient (to) is required' });
    }

    const ULTRAMSG_INSTANCE_ID = process.env.ULTRAMSG_INSTANCE_ID || 'instance187073';
    const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN || 'wb0k3py1v9f0bz0p';

    let cleanTo = to.replace(/[^0-9]/g, '');
    if (!cleanTo.startsWith('+') && !to.startsWith('+')) {
      cleanTo = `+${cleanTo}`;
    }

    console.log(`Sending UltraMsg WhatsApp message to ${cleanTo}...`);

    let endpoint = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}/messages/chat`;
    const params = new URLSearchParams();
    params.append('token', ULTRAMSG_TOKEN);
    params.append('to', cleanTo);

    if (mediaUrl) {
      if (fileType && fileType.includes('image')) {
        endpoint = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}/messages/image`;
        params.append('image', mediaUrl);
        if (text) params.append('caption', text);
      } else if (fileType && fileType.includes('audio')) {
        endpoint = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}/messages/audio`;
        params.append('audio', mediaUrl);
      } else {
        endpoint = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}/messages/document`;
        params.append('document', mediaUrl);
        params.append('filename', fileName || 'مرفق');
        if (text) params.append('caption', text);
      }
    } else {
      params.append('body', text || '');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('UltraMsg send error:', data);
      return res.status(500).json({
        success: false,
        message: data.error || 'فشل إرسال الرسالة عبر الواتساب',
        error: data.error
      });
    }

    console.log(`WhatsApp message sent successfully via UltraMsg to ${cleanTo}! ID: ${data.id}`);

    res.status(200).json({
      success: true,
      message: 'تم إرسال الرسالة بنجاح',
      messageId: data.id
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
