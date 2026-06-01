# 🛡️ BharatPay Pro: Safe Installation & Data Storage Directory Guide

Welcome to the **BharatPay Pro** directory setup and data management guide. This guide explains how to install the application and configure your data storage directory to ensure **maximum safety, data isolation, and total immunity against system failures or permission conflicts**.

---

## 📂 The Ideal Directory Layout

To protect your organization's transactional payroll records, attendance logs, and statutory data, we strictly separate the **Application Core** from your **Active Data Silos**. 

We highly recommend utilizing a non-system partition (like `D:` or `E:`) to bypass Windows User Account Control (UAC) permissions and keep your data safe even if your `C:` system partition is formatted or suffers a crash.

The ideal layout inside your chosen drive is as follows:

```
D:\BharatPayRoll\
├── 💻 BPP_APP\             <-- Core Application (Executables, launcher, patches)
└── 📊 BharatPP\            <-- App Data Storage Folder (Databases, reports, backups)
    ├── 🗄️ Data\            <-- Active SQLite databases and multi-company silos
    ├── 💾 Data backup\     <-- Secure encryption keys & backup zip files
    ├── 📈 Report files\    <-- Exported Excel sheets and PDF salary registers
    └── 📑 Templates\       <-- Default Excel template spreadsheets
```

---

## 🛠️ Phase-by-Phase Setup Instructions

Follow these three simple steps to configure this robust layout:

### 1️⃣ Step 1: Installer Location Setup
When running the **BharatPay Pro** installer or setting up the application files:
1. Create a parent folder named **`BharatPayRoll`** on your `D:` (or `E:`) drive: `D:\BharatPayRoll`
2. Install or place the application executable files directly inside a subfolder named **`BPP_APP`**:
   `D:\BharatPayRoll\BPP_APP`

---

### 2️⃣ Step 2: Storage Location Configuration
Once you launch the app, set your data storage folder using the settings dashboard:
1. Navigate to the **Data Management** tab (found in the sidebar settings).
2. Scroll to the bottom to the **App Storage Folder** configuration.
3. Provide your administrator password to unlock the settings.
4. Click **Select Storage Folder** and select the parent folder:
   👉 **`D:\BharatPayRoll`**
5. Confirm and save the settings.

---

### 3️⃣ Step 3: Automatic Layout Provisioning
Once you select `D:\BharatPayRoll`, the **BharatPay Pro** internal engine automatically takes over and sets up the directories under the hood:
* It detects that the path is a safe parent path and automatically creates the **`BharatPP`** directory inside it: `D:\BharatPayRoll\BharatPP`
* It provisions all required data, backup, and reporting subdirectories inside `BharatPP` automatically with **zero manual folder creation required** on your part.

---

## 🧠 Why is this Setup Highly Recommended?

| Feature | 🚫 Bad Practice (Using Default `C:\` folders) | 🏆 Best Practice (Using `D:\BharatPayRoll`) |
| :--- | :--- | :--- |
| **Write Permissions** | System folders on `C:` have strict UAC blocks, causing occasional database write failures. | `D:` partitions have completely relaxed permissions, ensuring 100% reliable database write operations. |
| **Windows Crashes** | If the Windows OS crashes, formatting `C:` will completely erase all databases and logs. | Your data remains completely safe on `D:` and can be immediately re-loaded post-system reinstall. |
| **Patch & App Updates** | Updating or uninstalling the app might accidentally overwrite or delete embedded databases. | Full isolation ensures that updating the application inside `BPP_APP` leaves your databases in `BharatPP` completely untouched. |
| **Volatile Storage Resistance** | Temporary application folders are volatile and can be wiped by system cleanup tools. | Persistent disk storage maintains all activation, license, and payroll records forever. |

---

> [!IMPORTANT]
> **Backup Reminder**: Always perform a secure backup via the **Data Management** panel before performing any manual operating system maintenance or drive cleanups. Your encrypted backups are stored safely inside `D:\BharatPayRoll\BharatPP\Data backup\`.
