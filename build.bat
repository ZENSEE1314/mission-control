@echo off
title Ruflo Mission Control — Build Installer
color 0B
setlocal EnableDelayedExpansion

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║   🌊  Ruflo Mission Control — .EXE Builder           ║
echo  ║   Builds a Windows installer you can share anywhere  ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: ── Step 1: Check Node.js ─────────────────────────────────
echo  [1/6] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
  echo  [ERROR] Node.js not found!
  echo  Please install Node.js 20+ from https://nodejs.org
  echo  Then re-run this file.
  pause & exit /b 1
)
for /f %%v in ('node --version') do echo  [OK] Node.js %%v

:: ── Step 2: Install ruflo ─────────────────────────────────
echo.
echo  [2/6] Checking ruflo...
npx claude-flow --version >nul 2>&1
if %errorlevel% neq 0 (
  echo  Installing ruflo...
  call npm install -g ruflo
) else (
  echo  [OK] ruflo already installed
)

:: ── Step 3: Install OpenClaw (smart — only if needed) ─────
echo.
echo  [3/6] Checking OpenClaw...
set CLAW_TARGET=2026.3.22
for /f %%v in ('npx openclaw --version 2^>nul') do set CLAW_CUR=%%v

if "!CLAW_CUR!"=="!CLAW_TARGET!" (
  echo  [OK] OpenClaw !CLAW_TARGET! already installed — skipping
) else (
  echo  Installing OpenClaw !CLAW_TARGET!...
  call npm install -g openclaw@!CLAW_TARGET!
  echo  [OK] OpenClaw !CLAW_TARGET! installed
)

:: ── Step 4: Install root dependencies ─────────────────────
echo.
echo  [4/6] Installing server dependencies...
call npm install
if %errorlevel% neq 0 (
  echo  [ERROR] npm install failed.
  pause & exit /b 1
)
echo  [OK] Server dependencies installed

:: ── Step 5: Install Electron + electron-builder ───────────
echo.
echo  [5/6] Installing Electron builder...
cd electron
call npm install
if %errorlevel% neq 0 (
  echo  [ERROR] Electron npm install failed.
  cd ..
  pause & exit /b 1
)
echo  [OK] Electron dependencies installed

:: ── Step 6: Generate icon if not present ──────────────────
if not exist "assets\icon.ico" (
  echo  [INFO] No icon found — generating placeholder...
  mkdir assets 2>nul
  :: Create a minimal valid ICO via PowerShell
  powershell -NoProfile -Command ^
    "$bmp = New-Object System.Drawing.Bitmap(256,256); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::FromArgb(0,212,255)); $font = New-Object System.Drawing.Font('Arial',120,[System.Drawing.FontStyle]::Bold); $g.DrawString('R',[System.Drawing.Font]::new('Arial',120,[System.Drawing.FontStyle]::Bold),[System.Drawing.Brushes]::Black,20,30); $icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon()); $stream = [System.IO.File]::OpenWrite('assets\icon.ico'); $icon.Save($stream); $stream.Close(); $g.Dispose(); $bmp.Dispose()" ^
  2>nul
  if not exist "assets\icon.ico" (
    :: Fallback: copy a system icon
    copy "%SystemRoot%\System32\shell32.dll" "assets\icon.ico" >nul 2>&1 || echo  [WARN] Could not generate icon — build will use default
  )
)

:: ── Build the installer ────────────────────────────────────
echo.
echo  [6/6] Building Windows installer (.exe)...
echo  This may take 3-5 minutes on first run...
echo.
call npm run dist

if %errorlevel% neq 0 (
  echo.
  echo  [ERROR] Build failed. Check the output above for details.
  echo.
  echo  Common fixes:
  echo    - Make sure you have a stable internet connection
  echo    - Run as Administrator if you see permission errors
  echo    - Delete node_modules and re-run this script
  cd ..
  pause & exit /b 1
)

cd ..

:: ── Done! ─────────────────────────────────────────────────
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║   ✅  BUILD COMPLETE!                                 ║
echo  ╠══════════════════════════════════════════════════════╣
echo  ║                                                       ║
echo  ║   📁 Your installer files are in:                    ║
echo  ║      electron\dist\                                   ║
echo  ║                                                       ║
echo  ║   📦 Ruflo Mission Control Setup.exe                  ║
echo  ║      → Full installer with desktop shortcut           ║
echo  ║                                                       ║
echo  ║   📦 Ruflo-Mission-Control-Portable.exe               ║
echo  ║      → No install needed, run from anywhere           ║
echo  ║                                                       ║
echo  ║   ✅ The installer checks for ruflo + OpenClaw        ║
echo  ║      and only downloads what's missing.               ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: Open the output folder
explorer "%~dp0electron\dist"
pause
