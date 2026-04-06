$adminPath = "c:\Users\TERMINAL 00\Desktop\RESERVA LESSA\src\pages\Admin.tsx"
$originalPath = "c:\Users\TERMINAL 00\Desktop\RESERVA LESSA\tmp\original_admin_utf8.tsx"

$adminContent = [System.IO.File]::ReadAllText($adminPath)
$originalContent = [System.IO.File]::ReadAllText($originalPath)

$markerStart = "const isOrder = resId.toString().startsWith('order-');"
$markerEnd = "const renderKioskTab = () => {"

$adminStartIndex = $adminContent.IndexOf($markerStart)
$adminEndIndex = $adminContent.IndexOf($markerEnd)

if ($adminStartIndex -eq -1 -or $adminEndIndex -eq -1) {
    Write-Error "Markers not found in Admin.tsx ($adminStartIndex, $adminEndIndex)"
    exit 1
}

$originalStartIndex = $originalContent.IndexOf($markerStart)
$originalEndIndex = $originalContent.IndexOf($markerEnd)

if ($originalStartIndex -eq -1 -or $originalEndIndex -eq -1) {
    Write-Error "Markers not found in original file"
    exit 1
}

$patch = $originalContent.Substring($originalStartIndex, $originalEndIndex - $originalStartIndex)
$patch = $patch.Replace("{count}/5 ocupados", "{count}/3 ocupados")

$newContent = $adminContent.Substring(0, $adminStartIndex) + $patch + $adminContent.Substring($adminEndIndex)

[System.IO.File]::WriteAllText($adminPath, $newContent)
Write-Host "Admin.tsx successfully repaired and restored!"
