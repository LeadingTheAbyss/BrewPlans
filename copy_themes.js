const fs = require('fs');
const path = require('path');

const srcDir = 'C:\\Users\\Kamlesh Singh\\.gemini\\antigravity-ide\\brain\\a7a79eb2-2d29-419a-b704-a2333ab9ba06';
const destDir = 'c:\\Users\\Kamlesh Singh\\Desktop\\Proj\\ghumi-ghumi\\public\\themes';

if (!fs.existsSync(destDir)){
    fs.mkdirSync(destDir, { recursive: true });
}

const files = fs.readdirSync(srcDir);
files.forEach(file => {
    if (file.startsWith('theme_') && file.endsWith('.png')) {
        const cleanName = file.replace(/_\d+\.png$/, '.png');
        fs.copyFileSync(path.join(srcDir, file), path.join(destDir, cleanName));
        console.log(`Copied ${file} to ${cleanName}`);
    }
});
