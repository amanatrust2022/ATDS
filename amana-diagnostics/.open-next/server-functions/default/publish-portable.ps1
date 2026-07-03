# =============================================================================
# AMANA DIAGNOSTICS — Publish Portable ZIP to Public Release Repository
# =============================================================================

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "               PUBLISHING PORTABLE HUB TO PUBLIC REPO                " -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""

$ProjectDir = Get-Location
$PortableZipSource = Join-Path (Join-Path $ProjectDir "dist") "amana-hub-portable.zip"
$ReleaseRepoUrl = "git@github.com-atds:amanatrust2022/amana-releases.git"
$TempCloneDir = Join-Path $ProjectDir "temp-releases-clone"

# Ensure the zip exists
if (-not (Test-Path $PortableZipSource)) {
    Write-Error "Error: dist/amana-hub-portable.zip not found. Run 'npm run dist:package' first."
    exit 1
}

# Clean old temp directory if exists
if (Test-Path $TempCloneDir) {
    Remove-Item -Path $TempCloneDir -Recurse -Force
}

# Clone the public releases repository
Write-Host "[1] Cloning public releases repository..." -ForegroundColor Yellow
git clone $ReleaseRepoUrl $TempCloneDir

if (-not $?) {
    Write-Error "Failed to clone release repository."
    exit 1
}

# Copy the portable zip to the cloned repository
Write-Host "[2] Copying portable zip to clone directory..." -ForegroundColor Yellow
$PortableZipDest = Join-Path $TempCloneDir "amana-hub-portable.zip"
Copy-Item -Path $PortableZipSource -Destination $PortableZipDest -Force

# Commit and Push to public repo
Write-Host "[3] Committing and pushing to GitHub..." -ForegroundColor Yellow
Push-Location $TempCloneDir
git add amana-hub-portable.zip
git commit -m "Update amana-hub-portable.zip (build $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))"
git push origin main
Pop-Location

# Clean up temp folder
Write-Host "[4] Cleaning up temp directory..." -ForegroundColor Yellow
Remove-Item -Path $TempCloneDir -Recurse -Force

Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "🎉 PORTABLE HUB PUBLISHED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "Download URL: https://raw.githubusercontent.com/amanatrust2022/amana-releases/main/amana-hub-portable.zip" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
