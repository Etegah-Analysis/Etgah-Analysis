import { dbAdmin } from './firebaseAdmin.js';

export default async function handler(req, res) {
  try {
    if (!dbAdmin) {
      return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }

    const msgsRef = dbAdmin.collection('رسائل_الموظفين_للعملاء');
    const snapshot = await msgsRef
      .where('status', '==', 'failed')
      .get();

    if (snapshot.empty) {
      return res.status(200).json({ message: 'No failed messages found' });
    }

    const errors = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      errors.push({
        id: doc.id,
        metaMessageId: data.metaMessageId,
        text: data.text,
        timestamp: data.timestamp,
        metaError: data.metaError
      });
    });

    return res.status(200).json({ errors });
  } catch (error) {
    console.error('Error fetching errors:', error);
    return res.status(500).json({ error: error.message });
  }
}
