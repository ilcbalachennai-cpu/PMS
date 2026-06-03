import json
import os

transcript_path = r'C:\Users\user\.gemini\antigravity-ide\brain\52700640-3dfd-4f46-8fd5-9da6f01deeb6\.system_generated\logs\transcript.jsonl'
best_content = None

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        if not line.strip(): continue
        try:
            entry = json.loads(line)
            if 'tool_calls' in entry:
                for tc in entry['tool_calls']:
                    if tc['name'] == 'write_to_file' and tc['arguments'].get('TargetFile', '').endswith('main.ts'):
                        best_content = tc['arguments'].get('CodeContent', '')
        except Exception as e:
            pass

if best_content:
    with open('recovered_main.ts', 'w', encoding='utf-8') as f:
        f.write(best_content)
    print("Recovered!")
else:
    print("Not found.")
