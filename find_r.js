const fs = require('fs');
const content = fs.readFileSync('d:\\ILCBala\\PMS\\BPP_GAS_Script_v02.02.10_ULTIMATE_HEARTBEAT_FULL.txt', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
    const tokens = line.split(/[^a-zA-Z0-9_]/);
    if (tokens.includes('r')) {
        console.log(`Line ${i + 1}: ${line}`);
    }
});
