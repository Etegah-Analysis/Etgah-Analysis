import { dbAdmin } from './firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // Twilio Webhooks send data as x-www-form-urlencoded
    const { From, Body, MediaUrl0, MediaContentType0 } = req.body;
    
    if (!From) {
      return res.status(400).send('Missing From phone number');
    }

    console.log(`Received WhatsApp message from ${From}: ${Body}`);

    if (!dbAdmin) {
      console.error('Firebase Admin not initialized, cannot save message.');
      return res.status(500).send('Database not initialized');
    }

    // Extract raw phone number (remove "whatsapp:" prefix)
    let phoneNumber = From;
    if (phoneNumber.startsWith('whatsapp:')) {
      phoneNumber = phoneNumber.replace('whatsapp:', '');
    }

    // Determine file details if MediaUrl0 exists
    let fileType = null;
    let fileName = null;
    if (MediaUrl0) {
      if (MediaContentType0) {
        if (MediaContentType0.includes('image')) fileType = 'image/jpeg';
        else if (MediaContentType0.includes('pdf')) fileType = 'application/pdf';
        else if (MediaContentType0.includes('video')) fileType = 'video/mp4';
        else if (MediaContentType0.includes('audio')) fileType = 'audio/mpeg';
        else fileType = MediaContentType0;
      } else {
        fileType = 'application/octet-stream';
      }
      fileName = 'مرفق_من_العميل';
    }

    // Find the chat in the users collection by phone
    const usersRef = dbAdmin.collection('users');
    const snapshot = await usersRef.where('phone', '==', phoneNumber).get();

    let userDocRef;

    if (snapshot.empty) {
      // If customer is not found, maybe create a new lead/user doc?
      // Or we can query by removing country code if it exists. Let's create a new doc for simplicity so admin sees it.
      const newUser = {
        name: 'عميل جديد (واتساب)',
        phone: phoneNumber,
        country: '',
        date: new Date().toLocaleString('ar-EG'),
        timestamp: FieldValue.serverTimestamp(),
        lastMessage: MediaUrl0 ? '📎 أرسل ملفاً' : Body,
        lastMessageTime: FieldValue.serverTimestamp(),
        unreadCount: 1,
        source: 'whatsapp'
      };
      userDocRef = await usersRef.add(newUser);
      console.log(`Created new chat document for ${phoneNumber}`);
    } else {
      userDocRef = snapshot.docs[0].ref;
      const userData = snapshot.docs[0].data();
      const newUnread = (userData.unreadCount || 0) + 1;
      
      // Update last message and unread count
      await userDocRef.update({
        lastMessage: MediaUrl0 ? '📎 أرسل ملفاً' : Body,
        lastMessageTime: FieldValue.serverTimestamp(),
        unreadCount: newUnread
      });
      console.log(`Updated existing chat document for ${phoneNumber}`);
    }

    // Save the actual message in the 'messages' subcollection
    const messagesRef = userDocRef.collection('messages');
    await messagesRef.add({
      text: Body || '',
      sender: 'customer',
      timestamp: FieldValue.serverTimestamp(),
      mediaUrl: MediaUrl0 || null,
      fileType: fileType,
      fileName: fileName
    });

    console.log(`Message successfully saved to Firestore for ${phoneNumber}.`);
    
    // Respond to Twilio (Twilio expects a 200 OK, optionally with TwiML)
    // We send empty TwiML so it doesn't auto-reply
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send('<Response></Response>');
  } catch (error) {
    console.error('Error handling Twilio Webhook:', error);
    res.status(500).send('Internal Server Error');
  }
}
