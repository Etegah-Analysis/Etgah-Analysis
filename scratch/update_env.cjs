const { execSync } = require('child_process');

const token = 'EAATZAYRkONGsBSKNAMiuw5hU9qnVrUOWdeiY0HqHmkIRxTV0Sg7xVU77aGunoM99bgZBrtRmsYHDDMTLHGdUsGUgsVIGkoeteRhXhkrB1ob3MYX88p8Ep8PtiZBto6RVFtQoG5KZBLQDYtSsHLIDrDg27ZC3dgpIrpe4LDVthFEJfd7lNZA4ByJZBsOMb609YduudvziFz0SOFrGetAgmVI4hZCYGZA9aklBCVc5jQ50nZAbDwqypbU3Y9diipqkjF2MlkEqsI8ZA1DgtL4Ny7UMqkx';
const phoneId = '1253387451197621';

function updateEnv(name, value) {
  try {
    console.log(`Removing ${name}...`);
    execSync(`npx vercel env rm ${name} production --yes`, { stdio: 'ignore' });
  } catch (e) {
    // Ignore error if it didn't exist
  }
  
  try {
    console.log(`Adding ${name}...`);
    execSync(`npx vercel env add ${name} production`, { input: value, stdio: ['pipe', 'inherit', 'inherit'] });
  } catch (e) {
    console.error(`Failed to add ${name}:`, e.message);
  }
}

updateEnv('WHATSAPP_TOKEN', token);
updateEnv('WHATSAPP_PHONE_NUMBER_ID', phoneId);
