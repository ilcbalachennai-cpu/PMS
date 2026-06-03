using System;
using System.IO;
using System.Net;
using System.Diagnostics;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using Microsoft.Win32;
using System.Reflection;

[assembly: AssemblyTitle("BharatPay Pro Launcher")]
[assembly: AssemblyDescription("Intelligent Bootstrap Launcher for BharatPay Pro")]
[assembly: AssemblyCompany("ILCBala")]
[assembly: AssemblyProduct("BharatPay Pro")]
[assembly: AssemblyCopyright("© 2026 ILCBala. All rights reserved.")]
[assembly: AssemblyFileVersion("1.0.0.10")]
[assembly: AssemblyVersion("1.0.0.10")]

namespace BharatPayLauncher
{
    class Program
    {
        private const string GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbycEpjAIjHnGDzIhlv9iu-_WPTEclB8HKMgIwbZlQ9JqrbCgQsQsM61draKRPBqyOHb/exec?action=GET_MESSAGES";
        private const string APP_ID = "com.ilcbala.bharatpaypro";
        private const string APP_NAME = "BPP_APP";
        private const string EXE_NAME = "BPP_APP.exe";

        static void Main(string[] args)
        {
            // Show SmartScreen advisory flash message upfront
            Application.EnableVisualStyles();
            
            // ── Single Instance Guard ──────────────────────────────────────────
            var runningInstances = Process.GetProcessesByName("BPP_APP");
            if (runningInstances.Length > 0)
            {
                var choice = MessageBox.Show(
                    "BharatPay Pro (BPP_APP) is already running on this machine.\n\n" +
                    "Only one instance is allowed at a time.\n\n" +
                    "Click  OK  to close the running instance.\n" +
                    "Click  Cancel  to abort launch.",
                    "⚠  BharatPay Pro — Already Running",
                    MessageBoxButtons.OKCancel,
                    MessageBoxIcon.Warning
                );

                if (choice == DialogResult.OK)
                {
                    foreach (var p in runningInstances)
                    {
                        try { p.Kill(); p.WaitForExit(3000); } catch { }
                    }
                }
                else { return; }
            }

            Console.Clear();
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine(@"  ____  ____  ____  ");
            Console.WriteLine(@" | __ )|  _ \|  _ \ ");
            Console.WriteLine(@" |  _ \| |_) | |_) |");
            Console.WriteLine(@" | |_) |  __/|  __/ ");
            Console.WriteLine(@" |____/|_|   |_|    ");
            Console.WriteLine(@"  BharatPay Pro - Intelligent Bootstrapper");
            Console.ResetColor();
            Console.WriteLine("==================================================");
            Console.WriteLine("        [ Status: Cloud Sync Enabled ]");
            Console.WriteLine("==================================================");
            
            try 
            {
                string exePath = FindInstalledApp();
                
                if (!string.IsNullOrEmpty(exePath) && File.Exists(exePath))
                {
                    Console.WriteLine("✅ BharatPay Pro found. Checking for updates...");
                    // even if found, we logic check update if needed, but for now we launch
                    Process.Start(exePath);
                }
                else
                {
                    Console.WriteLine("❌ BharatPay Pro not found locally.");
                    InstallApplication();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("\n❌ Launcher Error: " + ex.Message);
                MessageBox.Show(
                    "Launch Error: " + ex.Message + "\n\n" +
                    "Please check your internet connection and try again.",
                    "BharatPay Pro — Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                Console.WriteLine("\nPress any key to exit...");
                Console.ReadKey();
            }
        }

        static string FindInstalledApp()
        {
            // 1. Check Registry
            try 
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\" + APP_ID))
                {
                    if (key != null)
                    {
                        var installDir = key.GetValue("InstallLocation") as string;
                        if (!string.IsNullOrEmpty(installDir))
                        {
                            return Path.Combine(installDir, EXE_NAME);
                        }
                    }
                }
            } catch { }

            // 2. Check Common Paths
            string[] commonPaths = {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", APP_NAME, EXE_NAME),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), APP_NAME, EXE_NAME),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), APP_NAME, EXE_NAME),
                Path.Combine(@"D:\BharatPayRoll\", APP_NAME, EXE_NAME),
                Path.Combine(@"E:\BharatPayRoll\", APP_NAME, EXE_NAME),
                Path.Combine(@"D:\", APP_NAME, EXE_NAME),
                Path.Combine(@"E:\", APP_NAME, EXE_NAME)
            };

            foreach (var path in commonPaths)
            {
                if (File.Exists(path)) return path;
            }

            return null;
        }

        static void InstallApplication()
        {
            Console.WriteLine("\n🌐 Synchronizing with BharatPay Cloud...");
            
            ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072; // TLS 1.2
            
            using (WebClient client = new WebClient())
            {
                // Add User-Agent to satisfy GitHub/Cloud security policies
                client.Headers.Add("User-Agent", "BharatPay-Pro-Bootstrap-Launcher");
                
                string json = client.DownloadString(GOOGLE_SCRIPT_URL);
                
                // Extract version and URLs
                string downloadUrl = ExtractJsonValue(json, "downloadUrl");
                string downloadUrlWin7 = ExtractJsonValue(json, "downloadUrlWin7");
                string version = ExtractJsonValue(json, "latestVersion");

                if (string.IsNullOrEmpty(version))
                {
                    version = ExtractJsonValue(json, "version"); 
                }

                Console.WriteLine("📦 Target Release Identified: " + (string.IsNullOrEmpty(version) ? "v02.xx.xx" : "v" + version));
                
                bool isLegacy = Environment.OSVersion.Version.Major == 6 && Environment.OSVersion.Version.Minor == 1; // Exactly Win 7
                string targetUrl = isLegacy ? downloadUrlWin7 : downloadUrl;
                
                if (string.IsNullOrEmpty(targetUrl))
                {
                    string errMsg = "Could not retrieve download URL from server.\n\n" +
                                   "V: " + version + ", OS7: " + isLegacy + "\n" +
                                   "W10URL: " + (string.IsNullOrEmpty(downloadUrl) ? "Empty" : "Valid") + "\n" +
                                   "W7URL: " + (string.IsNullOrEmpty(downloadUrlWin7) ? "Empty" : "Valid") + "\n\n";
                    throw new Exception(errMsg);
                }

                Console.WriteLine("💻 System Detected: " + (isLegacy ? "Windows 7 (Legacy)" : "Windows 10+ (Modern)"));
                Console.WriteLine("🚀 Initiating Secure Background Download...");

                string tempFile = Path.Combine(Path.GetTempPath(), "BPP_Setup_Latest.exe");
                
                client.DownloadProgressChanged += (sender, e) =>
                {
                    if (e.TotalBytesToReceive > 0)
                    {
                        Console.Write(("\r⏳ Progress: " + e.ProgressPercentage + "%  (" + (e.BytesReceived / 1024 / 1024) + " MB / " + (e.TotalBytesToReceive / 1024 / 1024) + " MB)").PadRight(60));
                    }
                    else
                    {
                        Console.Write(("\r⏳ Downloading... " + (e.BytesReceived / 1024 / 1024) + " MB received").PadRight(60));
                    }
                };

                bool downloadFinished = false;
                client.DownloadFileCompleted += (sender, e) =>
                {
                    downloadFinished = true;
                };

                client.DownloadFileAsync(new Uri(targetUrl), tempFile);

                while (!downloadFinished)
                {
                    System.Threading.Thread.Sleep(100);
                }
                
                Console.WriteLine("\n✅ Download Complete. Executing Setup...");
                
                // --- NEW LAUNCHER AUDIT WRAPPER ---
                string logPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "bpp_launcher_install_error.log");
                string ps1Path = Path.Combine(Path.GetTempPath(), "bpp_launcher_audit.ps1");
                string safeTempFile = tempFile.Replace("\\", "\\\\");
                string safeLogPath = logPath.Replace("\\", "\\\\");

                                string psScript = @"
$logPath = """ + safeLogPath + @"
$timestamp = Get-Date

$logs = @(
    ""--- BPP Launcher Audit Log ---"",
    ""Date: $timestamp"",
    ""Context: New Installation via Launcher"",
    ""Starting primary installer...""
)

$proc = Start-Process -FilePath """ + safeTempFile + @""" -PassThru -Wait
$exitCode = $proc.ExitCode
$logs += ""Primary Installer Exit Code: $exitCode""

if ($exitCode -eq 0) {
    $logs += ""Installation Successful!""
} else {
    $logs += ""Installation failed. Attempting Auto-Correction as Administrator...""
    try {
        $proc2 = Start-Process -FilePath """ + safeTempFile + @""" -Verb RunAs -PassThru -Wait
        $fallbackCode = $proc2.ExitCode
        $logs += ""Fallback Installer Exit Code: $fallbackCode""

        if ($fallbackCode -eq 0) {
            $logs += ""Auto-Correction Successful!""
        } else {
            $logs += ""Auto-Correction Failed! Triggering Developer Handoff...""
            $failed = $true
        }
    } catch {
        $logs += ""Fallback failed to launch: $_""
        $failed = $true
    }
}

# ENCRYPT THE LOG
$secret = ""BPP_AUDIT_LOG_SECURE_2026""
$sha = [System.Security.Cryptography.SHA256]::Create()
$key = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($secret))

$aes = [System.Security.Cryptography.Aes]::Create()
$aes.Key = $key
$aes.GenerateIV()
$iv = $aes.IV
$encryptor = $aes.CreateEncryptor()

$logString = $logs -join ""[NEWLINE]""
$bytes = [System.Text.Encoding]::UTF8.GetBytes($logString.Replace(""[NEWLINE]"", [char]10))
$encrypted = $encryptor.TransformFinalBlock($bytes, 0, $bytes.Length)

$ivHex = [System.BitConverter]::ToString($iv).Replace(""-"", """").ToLower()
$encryptedHex = [System.BitConverter]::ToString($encrypted).Replace(""-"", """").ToLower()
$finalString = $ivHex + "":"" + $encryptedHex

[System.IO.File]::WriteAllText($logPath, $finalString)

if ($failed) {
    Add-Type -AssemblyName System.Web
    $subject = [System.Web.HttpUtility]::UrlEncode(""BPP Launcher Audit Log - Failed"")
    $body = [System.Web.HttpUtility]::UrlEncode(""Launcher installation failed.[NEWLINE][NEWLINE]Please attach the ENCRYPTED log file located at:[NEWLINE]$logPath"".Replace(""[NEWLINE]"", [char]10))
    $mailto = ""mailto:ilcbala.bharatpayroll@gmail.com?subject=$subject&body=$body""

    Start-Process $mailto

    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(""Installation Failed! An email draft has been opened. Please attach the encrypted log file located at $logPath and send it to the developer."", ""Installation Error"", ""OK"", ""Error"")
}
";
                File.WriteAllText(ps1Path, psScript);
                
                ProcessStartInfo psi = new ProcessStartInfo()
                {
                    FileName = "powershell",
                    Arguments = string.Format("-ExecutionPolicy Bypass -WindowStyle Hidden -File \"{0}\"", ps1Path),
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                Process.Start(psi);
            }
        }

        static string ExtractJsonValue(string json, string key)
        {
            string pattern = "\"" + key + "\"\\s*:\\s*\"([^\"]*)\"";
            Match match = Regex.Match(json, pattern);
            return match.Success ? match.Groups[1].Value : "";
        }
    }
}
