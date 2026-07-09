const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            results.push(file);
        }
    });
    return results;
}

const files = [...walk('components'), ...walk('services')].filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
let replacedCount = 0;

files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    if (content.includes("from 'xlsx'") || content.includes('from "xlsx"')) {
        content = content.replace(/from 'xlsx'/g, "from 'xlsx-js-style'").replace(/from "xlsx"/g, 'from "xlsx-js-style"');
        fs.writeFileSync(f, content);
        replacedCount++;
    }
});

console.log('Replaced imports in ' + replacedCount + ' files.');
