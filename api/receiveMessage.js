import { dbAdmin, storageAdmin } from './firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  // 1. Webhook Verification for Meta
  if (req.method === 'GET') {
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
    
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];
    
    if (mode && token) {
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
        return res.status(200).send(challenge);
      } else {
        return res.status(403).send('Forbidden');
      }
    }
    return res.status(400).send('Bad Request');
  }

  // 2. Receiving Messages
  if (req.method === 'POST') {
    try {
      const body = req.body;
      
      // Check if this is an event from a WhatsApp API
      if (body.object === 'whatsapp_business_account') {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const messages = value?.messages;
        const contacts = value?.contacts;
        
        // If there's a message
        if (messages && messages.length > 0) {
          const message = messages[0];
          const contact = contacts?.[0];
          
          const From = message.from; // Phone number
          const customerName = contact?.profile?.name || 'عميل جديد (واتساب)';
          
          let Body = '';
          let MediaUrl0 = null;
          let fileType = null;
          let fileName = null;
          
          let fileBuffer = null;
          let mediaId = null;

          if (message.type === 'text') {
            Body = message.text.body;
          } else if (message.type === 'button') {
            Body = message.button.text || message.button.payload;
          } else if (message.type === 'interactive') {
            const interactive = message.interactive;
            Body = interactive.button_reply?.title || interactive.list_reply?.title || 'استجابة';
          } else if (message.type === 'image') {
            Body = '📎 أرسل صورة';
            mediaId = message.image.id;
            fileType = message.image.mime_type || 'image/jpeg';
            fileName = 'صورة_من_العميل';
          } else if (message.type === 'document') {
            Body = '📎 أرسل مستند';
            mediaId = message.document.id;
            fileType = message.document.mime_type || 'application/pdf';
            fileName = message.document.filename || 'مستند';
          } else if (message.type === 'audio') {
            Body = '📎 أرسل مقطع صوتي';
            mediaId = message.audio.id;
            fileType = message.audio.mime_type || 'audio/mpeg';
            fileName = 'تسجيل_صوتي';
          } else if (message.type === 'video') {
            Body = '📎 أرسل فيديو';
            mediaId = message.video.id;
            fileType = message.video.mime_type || 'video/mp4';
            fileName = 'فيديو';
          } else {
            Body = `[رسالة من نوع: ${message.type}]`;
          }

          // If there is media, download it from WhatsApp and upload to Firebase
          if (mediaId) {
            try {
              const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
              // 1. Get media URL
              const mediaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
                headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` }
              });
              const mediaData = await mediaRes.json();
              
              if (mediaData.url) {
                // 2. Download media buffer
                const downloadRes = await fetch(mediaData.url, {
                  headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` }
                });
                fileBuffer = await downloadRes.arrayBuffer();
                
                // 3. Upload to Firebase Storage
                if (storageAdmin && fileBuffer) {
                  const bucket = storageAdmin.bucket();
                  const uniqueName = `${Date.now()}_${mediaId}`;
                  const file = bucket.file(`incoming_media/${uniqueName}`);
                  await file.save(Buffer.from(fileBuffer), {
                    metadata: { contentType: fileType }
                  });
                  await file.makePublic();
                  MediaUrl0 = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
                }
              }
            } catch (err) {
              console.error('Error downloading/uploading media:', err);
              MediaUrl0 = null; // fallback to null if failed
            }
          }

          console.log(`Received WhatsApp message from ${From}: ${Body}`);

          if (!dbAdmin) {
            console.error('Firebase Admin not initialized.');
            return res.status(500).send('Database not initialized');
          }

          // Format phone number to ensure it has '+' if missing
          let phoneNumber = From.startsWith('+') ? From : '+' + From;

          const crmRef = dbAdmin.collection('بيانات_تسجيل_العملاء');
          let snapshot = await crmRef.where('phoneNumber', '==', phoneNumber).get();
          
          if (snapshot.empty && phoneNumber.startsWith('+')) {
            snapshot = await crmRef.where('phoneNumber', '==', phoneNumber.substring(1)).get();
          }

          let chatDocId;

          let contactReason = 'general';
          if (Body.includes('تفاصيل') || Body.includes('مهتم')) {
            contactReason = 'details';
          } else if (Body.includes('دعم') || Body.includes('خدمة')) {
            contactReason = 'support';
          }

          if (snapshot.empty) {
            const newCustomer = {
              name: customerName,
              phoneNumber: phoneNumber,
              status: 'unassigned',
              addedBy: 'WhatsApp Webhook',
              assignedTo: '',
              assignedToUid: '',
              contactReason: contactReason,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
              lastMessage: Body,
              unread: 1
            };
            const docRef = await crmRef.add(newCustomer);
            chatDocId = docRef.id;
            console.log(`Created new chat document for ${phoneNumber}`);

            // Auto-Reply via Meta API
            if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
              try {
                const isChoice = Body.includes('تفاصيل') || Body.includes('مهتم') || Body.includes('دعم') || Body.includes('خدمة') || message.type === 'interactive' || message.type === 'button';
                
                if (isChoice) {
                  // If they sent their choice, reassure them
                  await fetch(`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      messaging_product: 'whatsapp',
                      recipient_type: 'individual',
                      to: From,
                      type: 'text',
                      text: {
                        body: 'سوف يتم التواصل مع حضرتك في أسرع وقت 🙏✨'
                      }
                    })
                  });
                } else {
                  // General text -> send interactive selection buttons
                  await fetch(`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      messaging_product: 'whatsapp',
                      recipient_type: 'individual',
                      to: From,
                      type: 'interactive',
                      interactive: {
                        type: 'button',
                        body: {
                          text: 'أهلاً بك في منصة اتجاه التحليل الذكي 👋\nيرجى اختيار سبب التواصل معنا:'
                        },
                        action: {
                          buttons: [
                            {
                              type: 'reply',
                              reply: { id: 'btn_details', title: '🎯 مهتم بالتفاصيل' }
                            },
                            {
                              type: 'reply',
                              reply: { id: 'btn_support', title: '🎧 خدمة دعم العملاء' }
                            }
                          ]
                        }
                      }
                    })
                  });
                }
              } catch (autoErr) {
                console.error('Error sending auto-reply:', autoErr);
              }
            }
          } else {
            chatDocId = snapshot.docs[0].id;
            const chatData = snapshot.docs[0].data();
            const newUnread = (chatData.unread || 0) + 1;
            
            const updatePayload = {
              lastMessage: Body,
              updatedAt: FieldValue.serverTimestamp(),
              unread: newUnread
            };
            if (contactReason !== 'general' || !chatData.contactReason) {
              updatePayload.contactReason = contactReason;
            }
            await snapshot.docs[0].ref.update(updatePayload);
            console.log(`Updated existing chat document for ${phoneNumber}`);

            // Also check if existing chat user pressed an interactive button or sent a choice option
            const isChoice = Body.includes('تفاصيل') || Body.includes('مهتم') || Body.includes('دعم') || Body.includes('خدمة') || message.type === 'interactive' || message.type === 'button';
            if (isChoice && process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
              try {
                await fetch(`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: From,
                    type: 'text',
                    text: {
                      body: 'سوف يتم التواصل مع حضرتك في أسرع وقت 🙏✨'
                    }
                  })
                });
              } catch (autoErr) {
                console.error('Error sending reassurance text to existing chat:', autoErr);
              }
            }
          }

          const messagesRef = dbAdmin.collection('رسائل_الموظفين_للعملاء');
          await messagesRef.add({
            conversationId: chatDocId,
            text: Body,
            sender: 'customer',
            phoneNumber: phoneNumber,
            timestamp: FieldValue.serverTimestamp(),
            mediaUrl: MediaUrl0,
            fileType: fileType,
            fileName: fileName,
            messageId: message.id
          });

          console.log(`Message successfully saved to Firestore for ${phoneNumber}.`);
        } else if (value?.statuses) {
          // Message delivery status update
          const statusObj = value.statuses[0];
          const metaMessageId = statusObj.id;
          const status = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
          console.log(`Received status update: ${status} for message ${metaMessageId}`);
          
          if (metaMessageId) {
            if (!dbAdmin) {
              console.error('Firebase Admin not initialized.');
              return res.status(500).send('Database not initialized');
            }
            
            const msgsRef = dbAdmin.collection('رسائل_الموظفين_للعملاء');
            let snapshot = await msgsRef.where('metaMessageId', '==', metaMessageId).get();
            
            // Handle Race Condition: Webhook might arrive before frontend saves the message to Firestore
            if (snapshot.empty) {
              console.log(`Message ${metaMessageId} not found in Firestore yet. Waiting 1.5 seconds for frontend to save it...`);
              await new Promise(resolve => setTimeout(resolve, 1500));
              snapshot = await msgsRef.where('metaMessageId', '==', metaMessageId).get();
            }

            if (!snapshot.empty) {
              const updatePayload = { status: status };
              if (statusObj.errors) {
                updatePayload.metaError = statusObj.errors;
              }
              await snapshot.docs[0].ref.update(updatePayload);
              console.log(`Updated message ${metaMessageId} status to ${status} in Firestore.`);
            } else {
              console.log(`Message ${metaMessageId} STILL not found in Firestore after delay. Skipping.`);
            }
          }
        }
        
        return res.status(200).send('EVENT_RECEIVED');
      } else {
        return res.status(404).send('Not Found');
      }
    } catch (error) {
      console.error('Error handling Meta Webhook:', error);
      return res.status(500).send('Internal Server Error');
    }
  }

  return res.status(405).send('Method Not Allowed');
}
