# Live preview for the native Android app — no Android Studio needed.
#
# Watches Kotlin sources; on every save it rebuilds the debug APK,
# reinstalls it on the connected device, and relaunches the app.
# Roughly 10-20s per cycle (incremental Gradle build).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File live-preview.ps1
# Stop with Ctrl+C.

$ErrorActionPreference = "Continue"

$projectRoot = $PSScriptRoot
$androidRoot = Join-Path $projectRoot "android"
$srcRoot = Join-Path $androidRoot "app\src\main\java"
$apkPath = Join-Path $androidRoot "app\build\outputs\apk\debug\app-debug.apk"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$packageName = "id.starstask.mobile"
$activityName = "id.starstask.mobile/.MainActivity"

if (-not (Test-Path $adb)) {
  Write-Host "adb not found at $adb" -ForegroundColor Red
  exit 1
}

$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

function Build-And-Install {
  Write-Host "[live] building..." -ForegroundColor Cyan
  Push-Location $androidRoot
  try {
    & .\gradlew.bat assembleDebug 2>&1 | Select-Object -Last 3
  } finally {
    Pop-Location
  }

  if (-not (Test-Path $apkPath)) {
    Write-Host "[live] build failed, no APK produced" -ForegroundColor Red
    return
  }

  Write-Host "[live] installing + launching..." -ForegroundColor Cyan
  & $adb install -r $apkPath 2>&1 | Select-Object -Last 1
  & $adb shell am force-stop $packageName 2>$null
  & $adb shell am start -n $activityName 2>&1 | Select-Object -Last 1
  Write-Host "[live] done — watching for changes (Ctrl+C to stop)" -ForegroundColor Green
}

function Get-LastWrite {
  Get-ChildItem $srcRoot -Recurse -Filter "*.kt" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 -ExpandProperty LastWriteTime
}

Write-Host "StarsTask live preview — watching $srcRoot" -ForegroundColor Green
Write-Host "First build now (or wait for a file save)..." -ForegroundColor Yellow

Build-And-Install
$lastWrite = Get-LastWrite

while ($true) {
  Start-Sleep -Seconds 2
  $now = Get-LastWrite
  if ($now -and $now -gt $lastWrite) {
    $lastWrite = $now
    Write-Host "`n[live] change detected at $now" -ForegroundColor Yellow
    Build-And-Install
  }
}
