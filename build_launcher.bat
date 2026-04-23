@echo off
:: BharatPay Pro Launcher Compiler (Failsafe Version)

:: Move to the folder where this batch file is located
pushd "%~dp0"

echo ========================================
echo   BharatPay Pro Launcher Compiler
echo ========================================

:: Check for 64-bit compiler
set "CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" (
    REM Check for 32-bit compiler
    set "CSC=C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)

if not exist "%CSC%" (
    echo [ERROR] Microsoft C# Compiler (csc.exe) not found.
    echo Please install .NET Framework 4.5 or higher.
    exit /b 1
)

echo [INFO] Found Compiler at %CSC%
echo [INFO] Working...

:: Delete old file if it exists
if exist Launch_BPP_V9.exe del Launch_BPP_V9.exe

:: Run the compilation
"%CSC%" /target:exe /out:Launch_BPP_V9.exe /optimize /win32icon:"release\.icon-ico\icon.ico" Launcher.cs

if exist Launch_BPP_V9.exe (
    echo.
    echo ========================================
    echo  SUCCESS: Launch_BPP_V9.exe created.
    echo ========================================
    echo You can now distribute Launch_BPP_V9.exe to your users.
) else (
    echo.
    echo [ERROR] Compilation failed. 
    echo Please check if Launcher.cs exists in this folder.
)

pause
popd
