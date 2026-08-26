# Top level instruction to change directory page text
DirText "Select other than $\"C$\" drive and create a folder $\"BharatPayRoll$\" in the selected directory to install the application"

!macro customHeader
!macroend

# Block C drive entirely from being selected
Function .onVerifyInstDir
    StrCpy $R0 $INSTDIR 3
    StrCmp $R0 "C:\" block_dir
    StrCmp $R0 "c:\" block_dir
    Goto end_verify
    
    block_dir:
    Abort
    
    end_verify:
FunctionEnd

!macro customInit
    # When installer starts, redirect default C: drive installs to D:\BharatPayRoll\BPP_APP
    # Only do this if it's a fresh install (BPP_APP.exe doesn't exist)
    IfFileExists "$INSTDIR\BPP_APP.exe" skip_custom_init
    
    StrCpy $R0 $INSTDIR 3
    ${If} $R0 == "C:\" 
    ${OrIf} $R0 == "c:\"
        StrCpy $INSTDIR "D:\BharatPayRoll\BPP_APP"
    ${EndIf}
    
    skip_custom_init:
!macroend

!macro customInstall
    # If this is an update, do NOT enforce \BharatPayRoll or show overwrite warnings
    IfFileExists "$INSTDIR\BPP_APP.exe" skip_custom_install
    
    # 1. Enforce \BharatPayRoll\BPP_APP in the install path
    StrLen $0 $INSTDIR
    ${If} $0 >= 22
        IntOp $1 $0 - 22
        StrCpy $2 $INSTDIR 22 $1
    ${Else}
        StrCpy $2 ""
    ${EndIf}
    
    ${If} $2 != "\BharatPayRoll\BPP_APP"
        # The user changed the directory. electron-builder appended \BPP_APP automatically.
        # Strip \BPP_APP (8 chars) and inject \BharatPayRoll\BPP_APP
        IntOp $0 $0 - 8
        StrCpy $1 $INSTDIR $0
        StrCpy $INSTDIR "$1\BharatPayRoll\BPP_APP"
    ${EndIf}

    # 2. Check for overwrite warning (parent folder BharatPayRoll)
    StrLen $0 $INSTDIR
    IntOp $0 $0 - 8
    StrCpy $1 $INSTDIR $0
    
    IfFileExists "$1\*.*" 0 skip_custom_install
        MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "The directory '$1' already exists and will be overwritten. Click OK to proceed with installation, or Cancel to abort." IDOK skip_custom_install
        Quit
        
    skip_custom_install:
    
    # Move manual_assets from the install directory to the parent directory (BharatPayRoll)
    GetFullPathName $3 "$INSTDIR\.."
    CopyFiles /SILENT "$INSTDIR\resources\manual_assets\*.*" "$3\"
    RMDir /r "$INSTDIR\resources\manual_assets"
    
    # Pre-create small HTA launch popup during install phase for INSTANT launch on finish
    FileOpen $0 "$TEMP\bpp_launch_msg.hta" w
    FileWrite $0 '<HTA:APPLICATION ID="oHTA" BORDER="dialog" CAPTION="yes" CONTEXTMENU="no" INNERBORDER="no" SCROLL="no" SHOWINTASKBAR="no" SINGLEINSTANCE="yes" SYSMENU="no" WINDOWSTATE="normal" ALWAYSONTOP="yes"/>$\r$\n'
    FileWrite $0 '<html><head><meta http-equiv="X-UA-Compatible" content="IE=edge"/>$\r$\n'
    FileWrite $0 '<title>BharatPay Pro Update</title>$\r$\n'
    FileWrite $0 '<style>$\r$\n'
    FileWrite $0 '  body { background-color: #020617; color: #f8fafc; font-family: $\'Segoe UI$\', Tahoma, Arial, sans-serif; margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; height: 100%; border: 1px solid #1e293b; box-sizing: border-box; overflow: hidden; }$\r$\n'
    FileWrite $0 '  .title { margin-bottom: 12px; font-weight: 700; font-size: 18px; color: #10b981; letter-spacing: 0.5px; }$\r$\n'
    FileWrite $0 '  .loading-box { font-size: 13px; color: #94a3b8; }$\r$\n'
    FileWrite $0 '  .wait-label { color: #38bdf8; font-weight: 600; }$\r$\n'
    FileWrite $0 '  .dots { color: #38bdf8; font-weight: 700; font-size: 16px; width: 24px; display: inline-block; text-align: left; }$\r$\n'
    FileWrite $0 '</style></head>$\r$\n'
    FileWrite $0 '<body>$\r$\n'
    FileWrite $0 '  <div class="title">Application Update Complete</div>$\r$\n'
    FileWrite $0 '  <div class="loading-box">$\r$\n'
    FileWrite $0 '    <span>Launching BharatPay Pro... <span class="wait-label">Please wait</span><span id="dots" class="dots">.</span></span>$\r$\n'
    FileWrite $0 '  </div>$\r$\n'
    FileWrite $0 '  <script>$\r$\n'
    FileWrite $0 '    window.resizeTo(560, 210); window.moveTo((screen.width - 560) / 2, (screen.height - 210) / 2); window.focus();$\r$\n'
    FileWrite $0 '    var step = 1; var waitEl = document.getElementById("dots");$\r$\n'
    FileWrite $0 '    setInterval(function() {$\r$\n'
    FileWrite $0 '      step = (step % 4) + 1; var d = ""; for (var i = 0; i < step; i++) { d += "."; }$\r$\n'
    FileWrite $0 '      if (waitEl) { waitEl.innerHTML = d; }$\r$\n'
    FileWrite $0 '      try { window.focus(); } catch(e) {}$\r$\n'
    FileWrite $0 '    }, 100);$\r$\n'
    FileWrite $0 '    setTimeout(function() { window.close(); }, 60000);$\r$\n'
    FileWrite $0 '  </script>$\r$\n'
    FileWrite $0 '</body></html>'
    FileClose $0

    # Set NSIS installer to automatically close upon progress completion
    SetAutoClose true
!macroend

# Function .onGUIEnd is executed AFTER the NSIS setup window has CLOSED COMPLETELY
Function .onGUIEnd
    # 1. Instantly launch small HTA info popup via direct CreateProcess (0ms delay)
    Exec '"mshta.exe" "$TEMP\bpp_launch_msg.hta"'

    # 2. Set working directory strictly to $INSTDIR so BPP_APP.exe finds all binaries & assets
    SetOutPath "$INSTDIR"

    # 3. Launch main application executable cleanly from $INSTDIR
    Exec '"$INSTDIR\BPP_APP.exe"'
FunctionEnd

