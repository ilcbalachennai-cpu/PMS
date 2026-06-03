import re
with open(r'C:\Users\user\.gemini\antigravity-ide\brain\52700640-3dfd-4f46-8fd5-9da6f01deeb6\.system_generated\tasks\task-788.log', 'r', encoding='utf-8') as f:
    text = f.read()

start = text.find('--- a/electron/main.ts')
end = text.find('Log: file:')

if start != -1 and end != -1:
    patch = text[start:end].strip()
    with open('main.patch', 'w', encoding='utf-8') as f:
        f.write(patch)
    print("Patch created")
else:
    print("Not found")
