# =============================================================================
#  WALIDA - Build APK Script (PowerShell)
# =============================================================================
#  This script builds the Vite web app, wraps it with Capacitor, and
#  produces an Android APK that is then copied to:
#   * ./public/apk/baraa-kids.apk   (served by Vite dev server)
#   * ./apk/baraa-kids.apk          (project archive copy)
#
#  Prerequisites (must be installed before running):
#   1. Node.js 18+
#   2. Java JDK 17+  (set JAVA_HOME)
#   3. Android SDK   (set ANDROID_HOME or ANDROID_SDK_ROOT)
#   4. Gradle
#
#  Usage:
#    .\build-apk.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

# Force JDK 21 for Gradle compilation
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path

Write-Host "Forced JAVA_HOME to: $env:JAVA_HOME" -ForegroundColor Cyan
java -version

Write-Host "WALIDA - Building APK..." -ForegroundColor Cyan

# -- Step 1: Build the web app ----------------------------------------------
Write-Host "Building Vite web app..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Vite build failed!"; exit 1 }

# -- Step 2: Install Capacitor if not present -------------------------------
Write-Host "Checking Capacitor..." -ForegroundColor Yellow
$hasCap = npm list @capacitor/core --depth=0 2>$null | Select-String "@capacitor/core"
if (-not $hasCap) {
    Write-Host "Installing Capacitor packages..." -ForegroundColor Gray
    npm install @capacitor/core @capacitor/cli @capacitor/android
}

# -- Step 3: Initialize Capacitor (only first time) ------------------------
Write-Host "Initializing Capacitor..." -ForegroundColor Yellow
if (-not (Test-Path ".\capacitor.config.json") -and -not (Test-Path ".\capacitor.config.ts")) {
    npx cap init "Baraa Kids" "com.baraa.kids" --web-dir dist
}

# -- Step 4: Add Android platform (only first time) ------------------------
if (-not (Test-Path ".\android")) {
    Write-Host "Adding Android platform..." -ForegroundColor Yellow
    npx cap add android
}

# -- Step 5: Sync web build to native --------------------------------------
Write-Host "Syncing web assets to Android..." -ForegroundColor Yellow
npx cap sync android

# -- Step 6: Build the APK -------------------------------------------------
Write-Host "Building Debug APK..." -ForegroundColor Yellow
Set-Location .\android
.\gradlew.bat assembleDebug
Set-Location ..

# -- Step 7: Copy APK to output directories --------------------------------
$APK_SRC = ".\android\app\build\outputs\apk\debug\app-debug.apk"
$APK_DEST_PUBLIC = ".\public\apk\baraa-kids.apk"
$APK_DEST_ARCHIVE = ".\apk\baraa-kids.apk"
$APK_DEST_DIST = ".\dist\apk\baraa-kids.apk"

if (Test-Path $APK_SRC) {
    if (-not (Test-Path ".\public\apk")) {
        New-Item -ItemType Directory -Force -Path ".\public\apk" | Out-Null
    }
    if (-not (Test-Path ".\apk")) {
        New-Item -ItemType Directory -Force -Path ".\apk" | Out-Null
    }
    if (-not (Test-Path ".\dist\apk")) {
        New-Item -ItemType Directory -Force -Path ".\dist\apk" | Out-Null
    }

    Copy-Item -Path $APK_SRC -Destination $APK_DEST_PUBLIC -Force
    Copy-Item -Path $APK_SRC -Destination $APK_DEST_ARCHIVE -Force
    Copy-Item -Path $APK_SRC -Destination $APK_DEST_DIST -Force

    $sizeVal = [math]::Round((Get-Item $APK_DEST_PUBLIC).Length / 1MB, 2)
    Write-Host "APK built successfully! ($sizeVal MB)" -ForegroundColor Green
    Write-Host "   -> $APK_DEST_PUBLIC" -ForegroundColor Green
    Write-Host "   -> $APK_DEST_ARCHIVE" -ForegroundColor Green
    Write-Host "   -> $APK_DEST_DIST" -ForegroundColor Green
} else {
    Write-Error "APK not found at expected path: $APK_SRC"
    exit 1
}

Write-Host "Done! Run 'npm run dev' to serve the APK download button." -ForegroundColor Cyan
