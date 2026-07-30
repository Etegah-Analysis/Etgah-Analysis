const { exec } = require('child_process');

console.log('Executing git push origin master...');
exec('git push origin master', { cwd: 'E:/سوفت وير ومنصه وواتس اب api/etegah-whatsapp-api' }, (error, stdout, stderr) => {
  console.log('STDOUT:', stdout);
  console.log('STDERR:', stderr);
  if (error) {
    console.error('ERROR:', error);
  } else {
    console.log('Git push completed successfully!');
  }
});
