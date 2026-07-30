import { initializeApp, cert } from 'firebase-admin/app';
import fs from 'fs';

const serviceAccount = JSON.parse(
  fs.readFileSync('E:/سوفت وير ومنصه وواتس اب api/etegah-dafe5-firebase-adminsdk-fbsvc-a9494dce90.json', 'utf8')
);

const app = initializeApp({
  credential: cert(serviceAccount)
});

async function getWebConfig() {
  const token = await app.options.credential.getAccessToken();
  console.log('Fetching Firebase Web Apps for etegah-dafe5...');
  
  const res = await fetch('https://firebase.googleapis.com/v1beta1/projects/etegah-dafe5/webApps', {
    headers: {
      Authorization: `Bearer ${token.access_token}`
    }
  });

  const data = await res.json();
  console.log('Web Apps:', JSON.stringify(data, null, 2));

  if (data.apps && data.apps.length > 0) {
    const appId = data.apps[0].appId;
    console.log(`Fetching config for appId ${appId}...`);
    const cfgRes = await fetch(`https://firebase.googleapis.com/v1beta1/projects/etegah-dafe5/webApps/${appId}/config`, {
      headers: {
        Authorization: `Bearer ${token.access_token}`
      }
    });
    const cfgData = await cfgRes.json();
    console.log('=== NEW FIREBASE WEB CONFIG ===');
    console.log(JSON.stringify(cfgData, null, 2));
  } else {
    console.log('No web apps registered yet in etegah-dafe5. Creating one...');
    const createRes = await fetch('https://firebase.googleapis.com/v1beta1/projects/etegah-dafe5/webApps', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ displayName: 'Etegah Web' })
    });
    const createData = await createRes.json();
    console.log('Created Web App:', JSON.stringify(createData, null, 2));
    
    // Get new app config
    const newAppId = createData.name.split('/').pop();
    const cfgRes = await fetch(`https://firebase.googleapis.com/v1beta1/projects/etegah-dafe5/webApps/${newAppId}/config`, {
      headers: {
        Authorization: `Bearer ${token.access_token}`
      }
    });
    const cfgData = await cfgRes.json();
    console.log('=== NEW FIREBASE WEB CONFIG ===');
    console.log(JSON.stringify(cfgData, null, 2));
  }
}

getWebConfig().catch(console.error);
