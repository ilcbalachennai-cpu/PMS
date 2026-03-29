
const fs = require('fs');
const path = require('path');

const filePath = 'd:/ILCBala/PMS/services/reportService.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Fix generateForm16PartBPDF around line 1009
const formBIndex = content.indexOf('export const generateFormB');
if (formBIndex !== -1) {
    const preFormB = content.substring(0, formBIndex);
    const lastClosingBraceIndex = preFormB.lastIndexOf('};');
    if (lastClosingBraceIndex !== -1) {
        content = content.substring(0, lastClosingBraceIndex) + '    return null;\n};' + content.substring(lastClosingBraceIndex + 2);
    }
}

// Fix generatePFForm3A around line 1300
// Important: we must search for generatePFForm6A AFTER updating the content once
const form6AIndex = content.indexOf('export const generatePFForm6A');
if (form6AIndex !== -1) {
    const preForm6A = content.substring(0, form6AIndex);
    const lastClosingBraceIndex = preForm6A.lastIndexOf('};');
    if (lastClosingBraceIndex !== -1) {
        content = content.substring(0, lastClosingBraceIndex) + '    return null;\n};' + content.substring(lastClosingBraceIndex + 2);
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed reportService.ts');
