using System;
using System.IO;
using System.Net;
using System.Diagnostics;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using Microsoft.Win32;

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

            Console.WriteLine("==================================================");
            Console.WriteLine("    BharatPay Pro — Intelligent Bootstrapper");
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
                Path.Combine(@"D:\", APP_NAME, EXE_NAME),
                Path.Combine(@"C:\", APP_NAME, EXE_NAME)
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
                string json = client.DownloadString(GOOGLE_SCRIPT_URL);
                
                // Extract version and URLs. 
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
                client.DownloadFile(targetUrl, tempFile);
                
                Console.WriteLine("✅ Download Complete. Executing Setup...");
                Process.Start(tempFile);
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
