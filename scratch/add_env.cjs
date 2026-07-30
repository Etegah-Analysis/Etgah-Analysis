const { execSync } = require('child_process');

const token = 'EAATZAYRkONGsBSKNAMiuw5hU9qnVrUOWdeiY0HqHmkIRxTV0Sg7xVU77aGunoM99bgZBrtRmsYHDDMTLHGdUsGUgsVIGkoeteRhXhkrB1ob3MYX88p8Ep8PtiZBto6RVFtQoG5KZBLQDYtSsHLIDrDg27ZC3dgpIrpe4LDVthFEJfd7lNZA4ByJZBsOMb609YduudvziFz0SOFrGetAgmVI4hZCYGZA9aklBCVc5jQ50nZAbDwqypbU3Y9diipqkjF2MlkEqsI8ZA1DgtL4Ny7UMqkx';
const phoneId = '1253387451197621';

try {
  console.log('Adding WHATSAPP_TOKEN...');
  execSync('npx vercel env add WHATSAPP_TOKEN production', { input: token, stdio: ['pipe', 'inherit', 'inherit'] });
  
  console.log('Adding WHATSAPP_PHONE_NUMBER_ID...');
  execSync('npx vercel env add WHATSAPP_PHONE_NUMBER_ID production', { input: phoneId, stdio: ['pipe', 'inherit', 'inherit'] });
  
  console.log('Success!');
} catch (error) {
  console.error('Error:', error.message);
}
