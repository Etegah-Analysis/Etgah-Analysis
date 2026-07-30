

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

const to = '201111493456';
const templateName = 'welcome_msg';
const languageCode = 'ar_EG'; // The language shown in the screenshot

async function run() {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode
      }
    }
  };

  console.log('Sending payload:', JSON.stringify(payload, null, 2));

  const response = await fetch(`https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  console.log('Response Status:', response.status);
  console.log('Response Data:', JSON.stringify(data, null, 2));
}

run();
