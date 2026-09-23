using System;
using System.IO;
using System.Net;
using System.Diagnostics;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using Microsoft.Win32;
using System.Reflection;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Security.Cryptography;
using System.Text;

[assembly: AssemblyTitle("BharatPay Pro Launcher")]
[assembly: AssemblyDescription("Intelligent Dual-Source Bootstrap Launcher for BharatPay Pro")]
[assembly: AssemblyCompany("ILCBala")]
[assembly: AssemblyProduct("BharatPay Pro")]
[assembly: AssemblyCopyright("© 2026 ILCBala. All rights reserved.")]
[assembly: AssemblyFileVersion("1.0.0.11")]
[assembly: AssemblyVersion("1.0.0.11")]

namespace BharatPayLauncher
{
    class Program
    {
        private const string GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzE10qkCCczPH-_eCQ_cJBRGpu28viV8zhNRCw2iD0Rha3y_1HIuWNPGAjHBrqsHeEB/exec?action=GET_MESSAGES";
        private const string GITHUB_REPO = "ilcbalachennai-cpu/BPP_Version_Update";
        private const string APP_ID = "com.ilcbala.bharatpaypro";
        private const string APP_NAME = "BPP_APP";
        private const string EXE_NAME = "BPP_APP.exe";

        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            
            bool forceUpdate = false;
            foreach (string arg in args)
            {
                if (arg.Equals("--update", StringComparison.OrdinalIgnoreCase) ||
                    arg.Equals("--force", StringComparison.OrdinalIgnoreCase) ||
                    arg.Equals("--install", StringComparison.OrdinalIgnoreCase) ||
                    arg.Equals("--repair", StringComparison.OrdinalIgnoreCase))
                {
                    forceUpdate = true;
                    break;
                }
            }

            // ── Single Instance Guard ──────────────────────────────────────────
            var runningInstances = Process.GetProcessesByName("BPP_APP");
            if (runningInstances.Length > 0)
            {
                var choice = MessageBox.Show(
                    "BharatPay Pro (BPP_APP) is currently running on this machine.\n\n" +
                    "To install updates or perform maintenance, the running instance must be closed.\n\n" +
                    "Click  OK  to close the running instance.\n" +
                    "Click  Cancel  to abort.",
                    "⚠  BharatPay Pro — Active Instance Detected",
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
            Console.WriteLine(@"  BharatPay Pro - Intelligent Dual-Source Bootstrapper");
            Console.ResetColor();
            Console.WriteLine("==================================================");
            Console.WriteLine("        [ Status: Cloud Sync & Recovery Enabled ]");
            Console.WriteLine("==================================================");
            
            try 
            {
                string exePath = FindInstalledApp();
                
                if (forceUpdate)
                {
                    Console.WriteLine("🔄 Force update flag detected. Initiating download...");
                    InstallApplication();
                }
                else if (!string.IsNullOrEmpty(exePath) && File.Exists(exePath))
                {
                    string localVer = "";
                    try
                    {
                        FileVersionInfo fvi = FileVersionInfo.GetVersionInfo(exePath);
                        localVer = fvi.ProductVersion ?? fvi.FileVersion ?? "";
                    }
                    catch { }

                    Console.WriteLine("✅ BharatPay Pro located at: " + exePath);
                    Console.WriteLine("📦 Local Version: " + (string.IsNullOrEmpty(localVer) ? "Installed" : "v" + localVer));

                    var userChoice = MessageBox.Show(
                        "BharatPay Pro is already installed on this machine.\n\n" +
                        "Installed Version: " + (string.IsNullOrEmpty(localVer) ? "Installed" : "v" + localVer) + "\n\n" +
                        "• Click [Yes] to check cloud for latest version and update/reinstall.\n" +
                        "• Click [No] to launch BharatPay Pro now.\n\n" +
                        "Note: All your employee data, payroll files, and settings remain 100% intact.",
                        "BharatPay Pro — Maintenance & Launcher",
                        MessageBoxButtons.YesNo,
                        MessageBoxIcon.Question
                    );

                    if (userChoice == DialogResult.Yes)
                    {
                        InstallApplication();
                    }
                    else
                    {
                        Console.WriteLine("🚀 Launching BharatPay Pro...");
                        Process.Start(exePath);
                    }
                }
                else
                {
                    Console.WriteLine("❌ BharatPay Pro not found locally. Starting fresh installation...");
                    InstallApplication();
                }
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("\n❌ Launcher Error: " + ex.Message);
                Console.ResetColor();
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
                            string candidate = Path.Combine(installDir, EXE_NAME);
                            if (File.Exists(candidate)) return candidate;
                        }
                    }
                }
            } catch { }

            // 2. Check Subfolder relative to Launcher directory (e.g. BharatPayRoll\BPP_APP\BPP_APP.exe)
            try
            {
                string launcherDir = AppDomain.CurrentDomain.BaseDirectory;
                string subDir = Path.Combine(launcherDir, APP_NAME, EXE_NAME);
                if (File.Exists(subDir)) return subDir;
                string sameDir = Path.Combine(launcherDir, EXE_NAME);
                if (File.Exists(sameDir)) return sameDir;
            } catch { }

            // 3. Check Common Paths
            string[] commonPaths = {
                Path.Combine(@"E:\BharatPayRoll\", APP_NAME, EXE_NAME),
                Path.Combine(@"D:\BharatPayRoll\", APP_NAME, EXE_NAME),
                Path.Combine(@"C:\BharatPayRoll\", APP_NAME, EXE_NAME),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", APP_NAME, EXE_NAME),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), APP_NAME, EXE_NAME),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), APP_NAME, EXE_NAME),
                Path.Combine(@"E:\", APP_NAME, EXE_NAME),
                Path.Combine(@"D:\", APP_NAME, EXE_NAME)
            };

            foreach (var path in commonPaths)
            {
                if (File.Exists(path)) return path;
            }

            return null;
        }

        static void InstallApplication()
        {
            Console.WriteLine("\n🌐 Synchronizing with BharatPay Cloud Configuration...");
            
            // Enable TLS 1.2
            ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072;
            
            string json = "";
            using (WebClient client = new WebClient())
            {
                client.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BharatPay-Pro-Bootstrap");
                json = client.DownloadString(GOOGLE_SCRIPT_URL);
            }
            
            // Extract configuration from Cloud Sheet
            string downloadUrl = ExtractJsonValue(json, "downloadUrl");
            string downloadUrlWin7 = ExtractJsonValue(json, "downloadUrlWin7");
            string version = ExtractJsonValue(json, "latestVersion");
            if (string.IsNullOrEmpty(version)) version = ExtractJsonValue(json, "version");
            if (string.IsNullOrEmpty(version)) version = "06.01.11";

            string hashWin10 = ExtractJsonValue(json, "updateHashWin10");
            string hashWin7 = ExtractJsonValue(json, "updateHashWin7");
            if (string.IsNullOrEmpty(hashWin10)) hashWin10 = ExtractJsonValue(json, "sha256");

            Console.WriteLine("📦 Target Release Identified: v" + version);
            
            bool isLegacy = (Environment.OSVersion.Version.Major == 6 && Environment.OSVersion.Version.Minor == 1);
            string osTag = isLegacy ? "Win7" : "Win10";
            Console.WriteLine("💻 System Detected: " + (isLegacy ? "Windows 7 (Legacy)" : "Windows 10+ (Modern)"));

            string primaryUrl = isLegacy ? downloadUrlWin7 : downloadUrl;
            string expectedHash = isLegacy ? hashWin7 : hashWin10;

            // Secondary Fallback URL (GitHub Releases)
            string fallbackUrl = "https://github.com/" + GITHUB_REPO + "/releases/download/V" + version + "/BPP_APP_V" + version + "_" + osTag + ".exe";

            // Ensure AppData permissions are provisioned
            ProvisionAppDataPermissions();

            string tempFile = Path.Combine(Path.GetTempPath(), "BPP_Setup_Latest.exe");
            if (File.Exists(tempFile))
            {
                try { File.Delete(tempFile); } catch { }
            }

            bool downloadSuccess = false;
            string errorDetail = "";

            // ── ATTEMPT 1: Primary Source (Google Drive) ──────────────────────────
            if (!string.IsNullOrEmpty(primaryUrl))
            {
                Console.WriteLine("\n🚀 [1/2] Connecting to Primary Cloud Source (Google Drive)...");
                if (DownloadFromGoogleDrive(primaryUrl, tempFile, out errorDetail))
                {
                    if (ValidateExecutable(tempFile, expectedHash, out errorDetail))
                    {
                        downloadSuccess = true;
                        Console.WriteLine("✅ Primary package verified successfully.");
                    }
                    else
                    {
                        Console.ForegroundColor = ConsoleColor.Yellow;
                        Console.WriteLine("⚠️ Primary validation notice: " + errorDetail);
                        Console.ResetColor();
                    }
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("⚠️ Primary download notice: " + errorDetail);
                    Console.ResetColor();
                }
            }

            // ── ATTEMPT 2: Secondary Source (GitHub Releases Fallback) ────────────
            if (!downloadSuccess)
            {
                Console.ForegroundColor = ConsoleColor.Cyan;
                Console.WriteLine("\n🔄 [2/2] Auto-Switching to Secondary Cloud Source (GitHub)...");
                Console.ResetColor();
                Console.WriteLine("🔗 URL: " + fallbackUrl);

                if (File.Exists(tempFile)) { try { File.Delete(tempFile); } catch { } }

                if (DownloadDirectStream(fallbackUrl, tempFile, out errorDetail))
                {
                    if (ValidateExecutable(tempFile, expectedHash, out errorDetail))
                    {
                        downloadSuccess = true;
                        Console.WriteLine("✅ Secondary package verified successfully.");
                    }
                    else
                    {
                        Console.ForegroundColor = ConsoleColor.Red;
                        Console.WriteLine("❌ Secondary validation failed: " + errorDetail);
                        Console.ResetColor();
                    }
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("❌ Secondary download failed: " + errorDetail);
                    Console.ResetColor();
                }
            }

            if (!downloadSuccess)
            {
                throw new Exception(
                    "Both download sources (Google Drive and GitHub) failed to deliver the verified installer package.\n\n" +
                    "Detail: " + errorDetail + "\n\n" +
                    "Please verify your internet connection or antivirus settings."
                );
            }

            Console.WriteLine("\n==================================================");
            Console.WriteLine("  Installation Package Verified. Executing Setup...");
            Console.WriteLine("==================================================");

            ProcessStartInfo psi = new ProcessStartInfo()
            {
                FileName = tempFile,
                UseShellExecute = true
            };
            Process.Start(psi);
        }

        static bool DownloadFromGoogleDrive(string gdriveUrl, string destPath, out string error)
        {
            error = null;
            try
            {
                // Auto-convert share/view links to direct uc link
                Match m = Regex.Match(gdriveUrl, @"drive\.google\.com/file/d/([a-zA-Z0-9_-]+)");
                string fileId = m.Success ? m.Groups[1].Value : "";
                if (!string.IsNullOrEmpty(fileId))
                {
                    gdriveUrl = "https://drive.google.com/uc?export=download&id=" + fileId;
                }
                else
                {
                    Match m2 = Regex.Match(gdriveUrl, @"[?&]id=([a-zA-Z0-9_-]+)");
                    if (m2.Success) fileId = m2.Groups[1].Value;
                }

                CookieContainer cookies = new CookieContainer();
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(gdriveUrl);
                request.CookieContainer = cookies;
                request.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
                request.AllowAutoRedirect = true;
                request.Timeout = 45000;

                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                {
                    string contentType = response.ContentType ?? "";
                    
                    // Check for Google Drive virus-scan bypass warning page
                    if (contentType.IndexOf("text/html", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        string html;
                        using (StreamReader sr = new StreamReader(response.GetResponseStream()))
                        {
                            html = sr.ReadToEnd();
                        }

                        Match uuidMatch = Regex.Match(html, @"name=""uuid""\s+value=""([^""]+)""");
                        Match idMatch = Regex.Match(html, @"name=""id""\s+value=""([^""]+)""");
                        string uuid = uuidMatch.Success ? uuidMatch.Groups[1].Value : "";
                        string formId = idMatch.Success ? idMatch.Groups[1].Value : fileId;

                        if (!string.IsNullOrEmpty(uuid) && !string.IsNullOrEmpty(formId))
                        {
                            string confirmUrl = "https://drive.usercontent.google.com/download?id=" + formId + "&export=download&confirm=t&uuid=" + uuid;
                            Console.WriteLine("🔄 Intercepted Google Drive security check. Streaming confirmed binary...");
                            
                            HttpWebRequest req2 = (HttpWebRequest)WebRequest.Create(confirmUrl);
                            req2.CookieContainer = cookies;
                            req2.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
                            req2.AllowAutoRedirect = true;
                            req2.Timeout = 600000; // 10 minutes

                            using (HttpWebResponse res2 = (HttpWebResponse)req2.GetResponse())
                            {
                                return StreamToFileWithProgress(res2, destPath, out error);
                            }
                        }
                        else
                        {
                            error = "Google Drive did not provide valid confirm token.";
                            return false;
                        }
                    }
                    else
                    {
                        return StreamToFileWithProgress(response, destPath, out error);
                    }
                }
            }
            catch (Exception ex)
            {
                error = ex.Message;
                return false;
            }
        }

        static bool DownloadDirectStream(string url, string destPath, out string error)
        {
            error = null;
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                req.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
                req.AllowAutoRedirect = true;
                req.Timeout = 600000;

                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    return StreamToFileWithProgress(resp, destPath, out error);
                }
            }
            catch (Exception ex)
            {
                error = ex.Message;
                return false;
            }
        }

        static bool StreamToFileWithProgress(HttpWebResponse response, string destPath, out string error)
        {
            error = null;
            try
            {
                long totalBytes = response.ContentLength;
                long receivedBytes = 0;
                byte[] buffer = new byte[65536];

                using (Stream inStream = response.GetResponseStream())
                using (FileStream outStream = new FileStream(destPath, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    int bytesRead;
                    while ((bytesRead = inStream.Read(buffer, 0, buffer.Length)) > 0)
                    {
                        outStream.Write(buffer, 0, bytesRead);
                        receivedBytes += bytesRead;
                        if (totalBytes > 0)
                        {
                            int pct = (int)((receivedBytes * 100) / totalBytes);
                            Console.Write(("\r⏳ Progress: " + pct + "% (" + (receivedBytes / 1024 / 1024) + " MB / " + (totalBytes / 1024 / 1024) + " MB)").PadRight(65));
                        }
                        else
                        {
                            Console.Write(("\r⏳ Downloading... " + (receivedBytes / 1024 / 1024) + " MB received").PadRight(65));
                        }
                    }
                }
                Console.WriteLine();
                return true;
            }
            catch (Exception ex)
            {
                error = ex.Message;
                return false;
            }
        }

        static bool ValidateExecutable(string filePath, string expectedHash, out string error)
        {
            error = null;
            try
            {
                if (!File.Exists(filePath))
                {
                    error = "File does not exist on disk.";
                    return false;
                }

                // Check MZ header
                byte[] header = new byte[2];
                using (FileStream fs = new FileStream(filePath, FileMode.Open, FileAccess.Read))
                {
                    if (fs.Length < 1024)
                    {
                        error = "File size is too small to be an installer package.";
                        return false;
                    }
                    fs.Read(header, 0, 2);
                }

                if (header[0] != 0x4D || header[1] != 0x5A) // 'M', 'Z'
                {
                    error = "File header verification failed. Received non-executable content.";
                    return false;
                }

                // Verify cryptographic SHA-256 hash if provided
                if (!string.IsNullOrEmpty(expectedHash))
                {
                    Console.WriteLine("🛡️ Verifying cryptographic SHA-256 checksum...");
                    using (SHA256 sha256 = SHA256.Create())
                    using (FileStream fs = File.OpenRead(filePath))
                    {
                        byte[] hashBytes = sha256.ComputeHash(fs);
                        StringBuilder sb = new StringBuilder();
                        foreach (byte b in hashBytes) sb.Append(b.ToString("X2"));
                        string computedHash = sb.ToString();

                        if (!string.Equals(computedHash, expectedHash, StringComparison.OrdinalIgnoreCase))
                        {
                            error = "Cryptographic integrity mismatch.\nExpected: " + expectedHash + "\nActual:   " + computedHash;
                            return false;
                        }
                    }
                    Console.WriteLine("✅ Cryptographic checksum verified successfully.");
                }

                return true;
            }
            catch (Exception ex)
            {
                error = ex.Message;
                return false;
            }
        }

        static void ProvisionAppDataPermissions()
        {
            try 
            {
                string appDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "BharatPay Pro");
                if (!Directory.Exists(appDataFolder))
                {
                    Directory.CreateDirectory(appDataFolder);
                }

                string currentUser = WindowsIdentity.GetCurrent().Name;
                DirectorySecurity dSecurity = Directory.GetAccessControl(appDataFolder);
                
                dSecurity.AddAccessRule(new FileSystemAccessRule(
                    currentUser,
                    FileSystemRights.FullControl,
                    InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
                    PropagationFlags.None,
                    AccessControlType.Allow));
                    
                Directory.SetAccessControl(appDataFolder, dSecurity);
            } 
            catch (Exception ex) 
            {
                Console.WriteLine("⚠️ Warning: Could not pre-provision folder permissions: " + ex.Message);
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
