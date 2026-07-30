function translateMetaError(rawError) {
  if (!rawError) return 'حدث خطأ غير معروف في خادم ميتا (Meta).';
  const str = String(rawError).toLowerCase();

  if (str.includes('public test numbers')) {
    return 'في مرحلة الاختيار التجريبية، يمكن إرسال الرسائل والقوالب فقط للأرقام المضافة والمعتمدة في لوحة تجارب ميتا (Meta Public Test Numbers). يرجى إضافة هذا الرقم في إعدادات Meta Developer أولاً.';
  }
  if (str.includes('template name does not exist')) {
    return 'اسم القالب المطلوب غير مسجل أو لم يتم اعتماده بعد بلغة هذا الرقم في حساب ميتا (Meta).';
  }
  if (str.includes('invalid parameter') || str.includes('unsupported phone number') || str.includes('not a valid whatsapp user')) {
    return 'رقم الهاتف غير صحيح أو غير مسجل بشركة واتساب.';
  }
  if (str.includes('rate limit') || str.includes('limit exceeded') || str.includes('too many requests')) {
    return 'تم تجاوز الحد الأقصى اليومي لإرسال الرسائل في حسابك، يرجى الانتظار قليلاً أو رفع شريحة الحساب في ميتا.';
  }
  if (str.includes('token') || str.includes('oauth') || str.includes('authentication')) {
    return 'رمز التوكن الخاطئ أو منتهي الصلاحية في إعدادات ميتا (Meta Authorization Token).';
  }
  if (str.includes('outside the allowed 24-hour window')) {
    return 'مرت أكثر من 24 ساعة على آخر رسالة للعميل، يجب الإرسال عبر "قالب مسجل" فقط لإعادة فتح المحادثة.';
  }

  return `خطأ من شركة ميتا: ${rawError}`;
}

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
    const { to, templateName, languageCode = 'ar_EG' } = req.body;
    
    if (!to || !templateName) {
      return res.status(400).json({ success: false, message: 'Missing "to" or "templateName"' });
    }

    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
    const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
    
    if (WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
      let toNumber = to.replace('+', '').trim();
      
      const sendMetaTemplate = async (lang) => {
        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toNumber,
          type: 'template',
          template: {
            name: templateName,
            language: { code: lang }
          }
        };

        const resp = await fetch(`https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        return { ok: resp.ok, status: resp.status, data: await resp.json() };
      };

      // First attempt with passed language code (e.g. ar_EG or ar)
      let result = await sendMetaTemplate(languageCode);

      // If failed due to language code mismatch, fallback to 'ar' or 'ar_EG'
      if (!result.ok && (languageCode === 'ar_EG' || languageCode === 'ar')) {
        const fallbackLang = languageCode === 'ar_EG' ? 'ar' : 'ar_EG';
        const fallbackResult = await sendMetaTemplate(fallbackLang);
        if (fallbackResult.ok) {
          result = fallbackResult;
        }
      }

      if (!result.ok) {
        const rawErrMsg = result.data?.error?.message || result.data?.error?.error_user_msg || 'Unknown error';
        const arabicMsg = translateMetaError(rawErrMsg);
        console.error('Meta WhatsApp template sending failed:', result.data);
        return res.status(500).json({
          success: false,
          message: arabicMsg,
          error: arabicMsg
        });
      }

      res.status(200).json({
        success: true,
        message: 'تم إرسال القالب بنجاح',
        metaMessageId: result.data.messages?.[0]?.id,
        simulated: false
      });
    } else {
      res.status(200).json({
        success: true,
        message: 'تم حفظ الرسالة (بدون توكن ميتا)',
        simulated: true
      });
    }
  } catch (error) {
    console.error('Error sending template:', error);
    res.status(500).json({
      success: false,
      message: 'فشل إرسال القالب',
      error: translateMetaError(error.message)
    });
  }
}
