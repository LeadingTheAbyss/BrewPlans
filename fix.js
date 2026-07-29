const fs = require('fs');
let file = fs.readFileSync('src/data/seedBlogs.ts', 'utf8');

file = file.replace(/timesPlanned: \d+,/g, () => {
  const val = Math.floor(Math.random() * 3); // 0, 1, 2
  return 'timesPlanned: ' + val + ',';
});

// Let's also do likes just in case they meant that, since likes are often "helpful"
file = file.replace(/likes: \d+,/g, () => {
  const val = Math.floor(Math.random() * 3); // 0, 1, 2
  return 'likes: ' + val + ',';
});

fs.writeFileSync('src/data/seedBlogs.ts', file);
console.log('Fixed counters in seedBlogs.ts');
