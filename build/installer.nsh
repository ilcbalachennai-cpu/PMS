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
    
    # If the installer is running silently (Patch Update), automatically launch the app after installing
    IfSilent 0 +2
    ExecShell "" "$INSTDIR\BPP_APP.exe"
!macroend

