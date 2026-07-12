const { exec } = require('child_process');
exec('npx tsc --noEmit', (error, stdout, stderr) => {
  console.log('STDOUT:', stdout);
  console.log('STDERR:', stderr);
  if (error) {
    console.log('ERROR CODE:', error.code);
  }
});
