Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead("dist\amana-hub-portable.zip")
$entries = $zip.Entries | Select-Object -First 10
foreach ($e in $entries) {
    Write-Host $e.FullName
}
Write-Host "..."
Write-Host "Total entries: $($zip.Entries.Count)"
# Check if amana-server.exe is included
$hasExe = $zip.Entries | Where-Object { $_.FullName -like "*amana-server.exe" }
if ($hasExe) { Write-Host "amana-server.exe: FOUND" } else { Write-Host "amana-server.exe: MISSING" }
$zip.Dispose()
