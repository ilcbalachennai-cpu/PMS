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
        private const string GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxYnFPLmvE1vCxLXVG53Ja1qx2VIeMZAz1b2v1-Kgh1k5b1bgo5lZnGM5Y3--r-uKbd/exec?action=GET_MESSAGES";
        private const string APP_ID = "com.ilcbala.bharatpaypro";
        private const string APP_NAME = "BPP_APP";
        private const string EXE_NAME = "BPP_APP.exe";

        static void Main(string[] args)
        {
            // Show SmartScreen advisory flash message upfront
            Application.EnableVisualStyles();
            MessageBox.Show(
                "WHY DO I SEE \"WINDOWS PROTECTED YOUR PC\"?\n\n" +
                "This is a standard Microsoft SmartScreen warning for unsigned software.\n" +
                "To proceed, click  \"More Info\"  and then  \"Run Anyway\".\n\n" +
                "This message is only shown once per session.",
                "⚠  BharatPay Pro — Software Security Notice",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information
            );

            Console.WriteLine("=====================================");
            Console.WriteLine("   BharatPay Pro Intelligent Launcher");
            Console.WriteLine("=====================================");
            
            try 
            {
                string exePath = FindInstalledApp();
                
                if (!string.IsNullOrEmpty(exePath) && File.Exists(exePath))
                {
                    Console.WriteLine("✅ BharatPay Pro found. Launching...");
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
                Console.WriteLine("\n❌ Error: " + ex.Message);
                Console.WriteLine("Press any key to exit...");
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
            Console.WriteLine("\n🌐 Fetching latest version info...");
            
            ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072; // TLS 1.2
            
            using (WebClient client = new WebClient())
            {
                string json = client.DownloadString(GOOGLE_SCRIPT_URL);
                
                // Simple regex to extract URLs without JSON library
                string downloadUrl = ExtractJsonValue(json, "downloadUrl");
                string downloadUrlWin7 = ExtractJsonValue(json, "downloadUrlWin7");
                string version = ExtractJsonValue(json, "latestVersion");

                Console.WriteLine("📦 Latest Version: " + version);
                
                bool isLegacy = Environment.OSVersion.Version.Major == 6; // Win 7/8/8.1
                string targetUrl = isLegacy ? downloadUrlWin7 : downloadUrl;
                
                if (string.IsNullOrEmpty(targetUrl))
                {
                    throw new Exception("Could not retrieve download URL from server.");
                }

                Console.WriteLine("💻 System: " + (isLegacy ? "Windows 7/8 (Legacy)" : "Windows 10+ (Modern)"));
                Console.WriteLine("🚀 Downloading Installer...");

                string tempFile = Path.Combine(Path.GetTempPath(), "BPP_Setup_" + version + ".exe");
                client.DownloadFile(targetUrl, tempFile);
                
                Console.WriteLine("✅ Download Complete. Starting Installation...");
                Process.Start(tempFile);
            }
        }

        static string ExtractJsonValue(string json, string key)
        {
            string pattern = "\"" + key + "\":\"([^\"]*)\"";
            Match match = Regex.Match(json, pattern);
            return match.Success ? match.Groups[1].Value : "";
        }
    }
}
