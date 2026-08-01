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
    const { to, templateName, messageText } = req.body;

    if (!to) {
      return res.status(400).json({ success: false, message: 'Phone number (to) is required' });
    }

    const ULTRAMSG_INSTANCE_ID = process.env.ULTRAMSG_INSTANCE_ID || 'instance187073';
    const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN || 'wb0k3py1v9f0bz0p';

    let cleanTo = to.replace(/[^0-9]/g, '');
    if (!cleanTo.startsWith('+') && !to.startsWith('+')) {
      cleanTo = `+${cleanTo}`;
    }

    let defaultText = messageText;
    if (!defaultText) {
      if (templateName === 'welcome_msg') {
        defaultText = `السلام عليكم 🤝 .. مع حضرتك منصه اتجاه التحليل الذكي 📉📈 .. نقدم خدمات دعم فني للسوق السعودي 🇸🇦 و السوق الامريكي 🇺🇸\nلو حضرتك مهتم بالتفاصيل ارسل تم`;
      } else {
        defaultText = `أهلاً بك في منصة اتجاه التحليل الذكي 📈`;
      }
    }

    const params = new URLSearchParams();
    params.append('token', ULTRAMSG_TOKEN);
    params.append('to', cleanTo);
    params.append('body', defaultText);

    const response = await fetch(`https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}/messages/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('UltraMsg template error:', data);
      return res.status(500).json({
        success: false,
        message: data.error || 'فشل إرسال القالب',
        error: data.error
      });
    }

    res.status(200).json({
      success: true,
      message: 'تم إرسال القالب بنجاح عبر الواتساب',
      messageId: data.id
    });
  } catch (error) {
    console.error('Error in sendTemplate:', error);
    res.status(500).json({
      success: false,
      message: 'فشل إرسال القالب',
      error: error.message
    });
  }
}
