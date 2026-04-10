const fs = require('fs');
const content = fs.readFileSync('d:/ILCBala/PMS/services/reportService.ts', 'utf8');
const matches = content.match(/export const (\w+)/g);
console.log(matches ? matches.join('\n') : 'No matches found');
const matchesFunc = content.match(/export function (\w+)/g);
console.log(matchesFunc ? matchesFunc.join('\n') : 'No function matches found');
const matchesAsync = content.match(/export const (\w+) = async/g);
console.log(matchesAsync ? matchesAsync.join('\n') : 'No async matches found');
