import { dbAdmin, storageAdmin } from './firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).send('UltraMsg Webhook Active');
  }

  if (req.method === 'POST') {
    try {
      const body = req.body;
      console.log('Incoming UltraMsg Webhook:', JSON.stringify(body));

      const eventData = body.data || body;
      const eventType = body.event_type || body.event;

      if (eventData && (eventType === 'message_received' || eventData.from)) {
        let rawFrom = eventData.from || '';
        let cleanFrom = rawFrom.split('@')[0].replace(/[^0-9]/g, '');

        if (!cleanFrom) {
          return res.status(200).json({ status: 'ignored' });
        }

        const phoneWithPlus = `+${cleanFrom}`;
        const customerName = eventData.pushname || eventData.sender_name || 'عميل جديد (واتساب)';
        const textMessage = eventData.body || eventData.text || '';
        const mediaUrl = eventData.media || null;
        const msgType = eventData.type || 'chat';

        let fileType = null;
        let fileName = null;

        if (msgType === 'image') {
          fileType = 'image/jpeg';
          fileName = 'صورة';
        } else if (msgType === 'document') {
          fileType = 'application/pdf';
          fileName = eventData.filename || 'مستند';
        } else if (msgType === 'audio' || msgType === 'voice') {
          fileType = 'audio/mpeg';
          fileName = 'تسجيل_صوتي';
        }

        const messageId = eventData.id || `msg_${Date.now()}`;

        if (dbAdmin) {
          // 1. Create or update user in 'بيانات_تسجيل_العملاء'
          const customerRef = dbAdmin.collection('بيانات_تسجيل_العملاء').doc(phoneWithPlus);
          const customerSnap = await customerRef.get();

          if (!customerSnap.exists) {
            await customerRef.set({
              id: phoneWithPlus,
              name: customerName,
              phone: cleanFrom,
              country: `+${cleanFrom.substring(0, 3)}`,
              assignedTo: '',
              assignedToName: '',
              status: 'unassigned',
              addedBy: 'WhatsApp Webhook',
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
              lastMessage: textMessage || 'مرفق وسائط',
              unreadCount: 1
            });
          } else {
            const currentData = customerSnap.data();
            await customerRef.update({
              lastMessage: textMessage || 'مرفق وسائط',
              updatedAt: FieldValue.serverTimestamp(),
              unreadCount: (currentData.unreadCount || 0) + 1,
              name: (currentData.name && currentData.name !== 'عميل جديد (واتساب)') ? currentData.name : customerName
            });
          }

          // 2. Save message to 'رسائل_الموظفين_للعملاء'
          await dbAdmin.collection('رسائل_الموظفين_للعملاء').doc(messageId).set({
            customerId: phoneWithPlus,
            customerPhone: phoneWithPlus,
            customerName: customerName,
            sender: 'customer',
            senderName: customerName,
            text: textMessage,
            mediaUrl: mediaUrl,
            fileType: fileType,
            fileName: fileName,
            timestamp: FieldValue.serverTimestamp(),
            createdAt: new Date().toISOString()
          });

          console.log(`Saved incoming WhatsApp message from ${phoneWithPlus} to Firestore!`);
        }
      }

      return res.status(200).json({ status: 'success' });
    } catch (error) {
      console.error('Error in UltraMsg receiveMessage Webhook:', error);
      return res.status(500).json({ status: 'error', error: error.message });
    }
  }

  return res.status(405).send('Method Not Allowed');
}
