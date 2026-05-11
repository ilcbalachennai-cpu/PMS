@echo off
echo ========================================
echo   BharatPay Pro Launcher Compiler
echo ========================================

if exist "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" (
    set "CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
) else (
    set "CSC=C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)

if exist "%CSC%" (
    echo [INFO] Found Compiler at %CSC%
    echo [INFO] Working...

    if exist Launch_BPP_V9.exe del Launch_BPP_V9.exe

    "%CSC%" /target:exe /out:Launch_BPP_V9.exe /optimize /win32icon:"release\.icon-ico\icon.ico" Launcher.cs

    if exist Launch_BPP_V9.exe (
        echo.
        echo ========================================
        echo  SUCCESS: Launch_BPP_V9.exe created.
        echo ========================================
    ) else (
        echo.
        echo [ERROR] Compilation failed.
    )
) else (
    echo [ERROR] Microsoft C# Compiler (csc.exe) not found.
    echo Please install .NET Framework 4.5 or higher.
)

pause
