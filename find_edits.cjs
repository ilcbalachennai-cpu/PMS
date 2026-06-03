const fs = require('fs');
const lines = fs.readFileSync('C:/Users/user/.gemini/antigravity-ide/brain/52700640-3dfd-4f46-8fd5-9da6f01deeb6/.system_generated/logs/transcript.jsonl', 'utf8').split('\n');

let bestContent = null;
let bestReplace = null;

for (let line of lines) {
    if (!line) continue;
    try {
        const entry = JSON.parse(line);
        if (entry.tool_calls) {
            for (let tc of entry.tool_calls) {
                if (tc.name === 'write_to_file' || tc.name === 'multi_replace_file_content' || tc.name === 'replace_file_content') {
                    if (tc.arguments.TargetFile && tc.arguments.TargetFile.endsWith('electron\\main.ts')) {
                        console.log('Found edit on step', entry.step_index, tc.name);
                    }
                }
            }
        }
        if (entry.type === 'TOOL_RESPONSE' && entry.name === 'run_command' && entry.content && entry.content.includes('Task Description: git log -p -1 electron/main.ts')) {
             console.log("Found git log");
        }
    } catch(e) {}
}
