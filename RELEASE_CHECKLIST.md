# BharatPay Pro — Release Checklist

To prevent "infinite update" loops or version mismatches, follow this checklist before every production build.

## 1. Version Synchronization
- [ ] **package.json**: Update `"version"` (e.g., `02.02.21`).
- [ ] **package.json**: Update `artifactName` in `build:win10` and `build:win7` scripts.
- [ ] **licenseService.ts**: Update `APP_VERSION` constant (must match `package.json`).
- [ ] **Google Apps Script**: Deploy new version of the Web App and confirm it returns the correct `latestVersion`.

## 2. Environment Verification
- [ ] Ensure you are on the **Main** branch.
- [ ] Run `npm run build:restore` to ensure `node_modules` are clean and set for Win10.
- [ ] Run `npm run lint` (`tsc --noEmit`) to ensure no type errors.

## 3. Build & Package
- [ ] Run `npm run build:win10` (Generates the modern installer).
- [ ] Run `npm run build:win7` (Generates the legacy installer).
- [ ] Confirm both `.exe` files exist in the `release/` folder with correct naming.

## 4. Post-Build
- [ ] Upload installers to the cloud storage.
- [ ] Update the Google Apps Script `downloadUrl` and `downloadUrlWin7` configuration.
- [ ] Perform a test installation of the new version to verify the rollover.

---
**Note:** Failing to update `APP_VERSION` in `licenseService.ts` will cause the app to repeatedly prompt for updates after installation.
