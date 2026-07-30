const { execSync } = require('child_process');

try {
  console.log('Removing old WHATSAPP_PHONE_NUMBER_ID...');
  execSync('npx vercel env rm WHATSAPP_PHONE_NUMBER_ID production -y', { stdio: 'inherit' });
} catch (e) { console.log('Not found, skipping'); }

try {
  console.log('Removing old WHATSAPP_TOKEN...');
  execSync('npx vercel env rm WHATSAPP_TOKEN production -y', { stdio: 'inherit' });
} catch (e) { console.log('Not found, skipping'); }

try {
  console.log('Adding new WHATSAPP_PHONE_NUMBER_ID...');
  execSync('npx vercel env add WHATSAPP_PHONE_NUMBER_ID production', {
    input: '1253387451197621\n',
    stdio: ['pipe', 'inherit', 'inherit']
  });
} catch (e) { console.error('Failed to add PHONE_NUMBER_ID', e); }

try {
  console.log('Adding new WHATSAPP_TOKEN...');
  execSync('npx vercel env add WHATSAPP_TOKEN production', {
    input: 'EAATZAYRkONGsBSFQBnAUGKAsZCUGtEjzlfZCXZBQsYtvOctSlM6ZBoyj2KKddfn3W23EZAYUFCtyZCWvw2ZBAyQrypJrdknPDqUuOeurWD8qqTLfVir8MpGxIaYdnSWKA8PsZCGpZAI8VIx2aJiDunf5Ck1k0k4vZBcianshO8TDJyXleIQBHN64UspUZBlVa9gVx8RCsaM8EmoZCz5MJ6ZBZBzjZBjpAupzxHAvPDdhIbzVvKwVDLCsWXSfT9qXfOcXdfHDbX3cheGVyZB33GiruPnvxpJgh\n',
    stdio: ['pipe', 'inherit', 'inherit']
  });
} catch (e) { console.error('Failed to add TOKEN', e); }

console.log('Done!');
