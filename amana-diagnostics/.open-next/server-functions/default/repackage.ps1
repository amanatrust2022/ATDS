Add-Type -AssemblyName System.IO.Compression.FileSystem

$distDir = "C:\Users\SURFACE\ATDS\amana-diagnostics\dist"
$zipPath = "$distDir\amana-hub-portable.zip"

# Remove old zip
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

# Create zip
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)

# Helper: add a file to the zip with the correct entry name
function Add-FileToZip($zip, $filePath, $entryName) {
    $entry = $zip.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
    $stream = $entry.Open()
    $fileStream = [System.IO.File]::OpenRead($filePath)
    $fileStream.CopyTo($stream)
    $fileStream.Close()
    $stream.Close()
    Write-Host "Added: $entryName"
}

# Helper: add all files in a directory recursively
function Add-DirectoryToZip($zip, $sourceDir, $zipBasePath) {
    $files = Get-ChildItem -Path $sourceDir -Recurse -File
    foreach ($file in $files) {
        $relativePath = $file.FullName.Substring($sourceDir.Length + 1).Replace('\', '/')
        $entryName = "$zipBasePath/$relativePath"
        $entry = $zip.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
        $stream = $entry.Open()
        $fileStream = [System.IO.File]::OpenRead($file.FullName)
        $fileStream.CopyTo($stream)
        $fileStream.Close()
        $stream.Close()
    }
    Write-Host "Added directory: $zipBasePath/ ($($files.Count) files)"
}

# Add amana-server.exe at root
Add-FileToZip $zip "$distDir\amana-server.exe" "amana-server.exe"

# Add version.json at root
Add-FileToZip $zip "$distDir\version.json" "version.json"

# Add server/ directory recursively
Add-DirectoryToZip $zip "$distDir\server" "server"

$zip.Dispose()

$size = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host ""
Write-Host "Done! amana-hub-portable.zip = $size MB"

# Verify exe is in the zip
$verify = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
$hasExe = $verify.Entries | Where-Object { $_.FullName -eq "amana-server.exe" }
if ($hasExe) { Write-Host "Verified: amana-server.exe is present in ZIP" }
else { Write-Host "ERROR: amana-server.exe missing from ZIP" }
$verify.Dispose()
