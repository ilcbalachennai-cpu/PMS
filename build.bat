@echo off
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /target:exe /reference:System.Windows.Forms.dll,System.Drawing.dll,System.dll /win32icon:"d:\ILCBala\PMS\release\.icon-ico\icon.ico" /out:d:\ILCBala\PMS\Launch_BPP.exe d:\ILCBala\PMS\Launcher.cs > d:\ILCBala\PMS\build_log.txt 2>&1
echo Build Finished. >> d:\ILCBala\PMS\build_log.txt
