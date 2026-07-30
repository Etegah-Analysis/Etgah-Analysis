async function checkSite() {
  console.log('Fetching https://whatsapp.etegah-analysis.com...');
  const res = await fetch('https://whatsapp.etegah-analysis.com');
  const html = await res.text();
  console.log('HTML status:', res.status);
  console.log('HTML snippet:\n', html.slice(0, 500));

  // Extract JS asset url
  const match = html.match(/src="(\/assets\/[^"]+)"/);
  if (match) {
    const jsUrl = 'https://whatsapp.etegah-analysis.com' + match[1];
    console.log('Fetching JS asset:', jsUrl);
    const jsRes = await fetch(jsUrl);
    console.log('JS Status:', jsRes.status);
    const jsText = await jsRes.text();
    console.log('JS length:', jsText.length);
  }
}

checkSite().catch(console.error);
