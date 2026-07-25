const fs = require('fs');
const path = require('path');

const replacements = {
    "PlanBro": "BrewPlans",
    "planbro": "brewplans",
    "PLANBRO": "BREWPLANS",
    "Planbro": "Brewplans"
};

const ignoreDirs = new Set([
    ".git", "node_modules", ".next", "__pycache__", ".venv", "venv", "build", "dist"
]);

const ignoreExts = new Set([
    ".png", ".jpg", ".jpeg", ".mp4", ".ico", ".svg", ".pdf", ".zip", ".tar", ".gz", ".woff", ".woff2", ".ttf", ".eot"
]);

function processFile(filepath) {
    try {
        let content = fs.readFileSync(filepath, 'utf8');
        let newContent = content;
        for (const [oldStr, newStr] of Object.entries(replacements)) {
            newContent = newContent.replaceAll(oldStr, newStr);
        }
        if (newContent !== content) {
            fs.writeFileSync(filepath, newContent, 'utf8');
            console.log(`Updated: ${filepath}`);
        }
    } catch (e) {
        // ignore binary/read errors
    }
}

function walk(dir) {
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const filepath = path.join(dir, file);
        const stat = fs.statSync(filepath);
        if (stat && stat.isDirectory()) {
            if (!ignoreDirs.has(file)) {
                walk(filepath);
            }
        } else {
            const ext = path.extname(file).toLowerCase();
            if (!ignoreExts.has(ext) && file !== 'rename.js' && file !== 'rename_brewplans.py') {
                processFile(filepath);
            }
        }
    }
}

walk(process.cwd());
console.log("Done renaming.");
