# DiagnosticOS: Desktop App Release Process

This document outlines the step-by-step release process for **DiagnosticOS** after updating the source code of the application.

---

## 1. Version Bumping
Before committing your changes, increment the version number: it is what triggers
the auto-updater and what names the installer packages. **Two files**, and they
must agree — `package.json` names the artifacts, `tauri.conf.json` is what an
installed app reports as its own version, and an updater offered a version it
already has will refuse the update.

1. **`amana-diagnostics/package.json`**:
   ```json
   "version": "1.2.21"
   ```
2. **`amana-diagnostics/src-tauri/tauri.conf.json`**:
   ```json
   "version": "1.2.21"
   ```

Then `npm install --package-lock-only` so `package-lock.json` agrees, or `npm ci`
fails on the runner before anything is built.

This used to list four files: the download page and the sign-in badge each had
the version typed into them by hand. Both now read it from `package.json`
(`import pkg from '@/package.json'`), so there is nothing to keep in step and
nothing to forget — the download link cannot name a build that was never made.

### Where releases go
`release.yml` publishes to **`amanatrust2022/amana-releases`**, which is where
every build from v1.2.10 onward lives. Two things have to keep pointing there,
and both were pointing at a repository that had never received a release:

- `src-tauri/tauri.conf.json` → `plugins.updater.endpoints` — compiled into the
  app, so a wrong value here is only fixed by a manual reinstall.
- `app/download/DownloadScreen.tsx` → `RELEASES` — the download buttons.

---

## 2. Commit & Tag Creation
Stage the changes, commit them to git, and **tag the commit** with the new version prefixed by `v`. Pushing this tag triggers the GitHub CI/CD pipeline.

Run the following commands in the root of the repository:
```bash
# 1. Stage all modifications
git add .

# 2. Commit the changes
git commit -m "Brief summary of features/fixes. Bump version to 1.2.21"

# 3. Create the local release tag
git tag v1.2.21

# 4. Push the code and tags to GitHub
git push origin main --tags
```
*(Ensure you are on a network where port 22/SSH is unrestricted, or use the HTTPS remote URL to push if port 22 is blocked).*

---

## 3. Automated CI/CD Compilation
The GitHub Actions workflow [release.yml](.github/workflows/release.yml) is automatically triggered by the tag push:
1. Compiles the Next.js production build and configures it in standalone mode.
2. Extracts the Next.js server and packages it alongside the Node.js runner inside Tauri as a background sidecar executable.
3. Compiles the Rust wrapper codebase into a production-optimized Windows executable.
4. Digitally signs the compiled executable using your private signing key (`TAURI_SIGNING_PRIVATE_KEY`) to bypass Windows SmartScreen warnings.
5. Bundles the NSIS installer (`.exe`), WiX installer (`.msi`), and updater package (`.zip`).
6. Generates `latest.json` containing the updater metadata, signature, and package hashes.

---

## 4. Release Publication & Auto-Update
* The pipeline automatically uploads all compiled installer artifacts and the updated `latest.json` file as a new release in the **`amanatrust2022/amana-releases`** repository.
* When users launch any older installed version of DiagnosticOS, the app's startup updater checks the GitHub releases page, detects the new version, downloads it, and prompts the user to apply the update and restart.
