const fs = require('fs');
let c = fs.readFileSync('electron/main.ts', 'utf8');

const oldStr = `const exeName = app.isPackaged ? 'BPP_APP.exe' : 'electron.exe';
                const wrapperPath = path.join(os.tmpdir(), 'bpp_audit_wrapper.ps1');
                const logPath = path.join(app.getPath('userData'), 'bpp_install_error.log');
                
                const scriptContent = \`
$logPath = "\${logPath.replace(/\\\\/g, '\\\\\\\\')}"
"--- BPP Update Audit Log ---" | Out-File -FilePath $logPath -Encoding utf8
"Date: $(Get-Date)" | Out-File -FilePath $logPath -Append -Encoding utf8
"User: \${username}" | Out-File -FilePath $logPath -Append -Encoding utf8
"Email: \${userEmail}" | Out-File -FilePath $logPath -Append -Encoding utf8
"OS: \${os.type()} \${os.release()}" | Out-File -FilePath $logPath -Append -Encoding utf8

"Killing \${exeName}..." | Out-File -FilePath $logPath -Append -Encoding utf8
Stop-Process -Name "\${exeName.replace('.exe', '')}" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

"Starting primary installer..." | Out-File -FilePath $logPath -Append -Encoding utf8
$proc = Start-Process -FilePath "\${installerPath.replace(/\\\\/g, '\\\\\\\\')}" \${isSilent ? '-ArgumentList "/S"' : ''} -PassThru -Wait
$exitCode = $proc.ExitCode`;

const newStr = `const currentExePath = app.getPath('exe');
                const exeName = require('path').basename(currentExePath);
                const wrapperPath = path.join(os.tmpdir(), 'bpp_audit_wrapper.ps1');
                const logPath = path.join(app.getPath('userData'), 'bpp_install_error.log');
                
                const scriptContent = \`
$logPath = "\${logPath.replace(/\\\\/g, '\\\\\\\\')}"
"--- BPP Update Audit Log ---" | Out-File -FilePath $logPath -Encoding utf8
"Date: $(Get-Date)" | Out-File -FilePath $logPath -Append -Encoding utf8
"User: \${username}" | Out-File -FilePath $logPath -Append -Encoding utf8
"Email: \${userEmail}" | Out-File -FilePath $logPath -Append -Encoding utf8
"OS: \${os.type()} \${os.release()}" | Out-File -FilePath $logPath -Append -Encoding utf8

"Killing \${exeName}..." | Out-File -FilePath $logPath -Append -Encoding utf8
Stop-Process -Name "\${exeName.replace('.exe', '')}" -Force -ErrorAction SilentlyContinue

"Waiting for process locks to release on \${currentExePath.replace(/\\\\/g, '\\\\\\\\')}..." | Out-File -FilePath $logPath -Append -Encoding utf8
$retries = 15
while ($retries -gt 0) {
    try {
        $stream = [System.IO.File]::Open("\${currentExePath.replace(/\\\\/g, '\\\\\\\\')}", 'Open', 'Read', 'None')
        $stream.Close()
        "Lock released successfully." | Out-File -FilePath $logPath -Append -Encoding utf8
        break
    } catch {
        Start-Sleep -Seconds 1
        $retries--
    }
}
if ($retries -eq 0) {
    "Warning: File still appears locked after 15 seconds, proceeding anyway..." | Out-File -FilePath $logPath -Append -Encoding utf8
}

"Starting primary installer..." | Out-File -FilePath $logPath -Append -Encoding utf8
$proc = Start-Process -FilePath "\${installerPath.replace(/\\\\/g, '\\\\\\\\')}" \${isSilent ? '-ArgumentList "/S"' : ''} -PassThru -Wait
$exitCode = $proc.ExitCode`;

if (c.includes(oldStr)) {
    c = c.replace(oldStr, newStr);
    fs.writeFileSync('electron/main.ts', c);
    console.log("Success");
} else {
    console.log("Could not find string");
}
`;
