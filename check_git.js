const { execSync } = require('child_process');
const fs = require('fs');

try {
  const output = execSync('git ls-files src/data').toString();
  fs.writeFileSync('git_files.txt', output);
} catch (e) {
  fs.writeFileSync('git_files.txt', e.message);
}
