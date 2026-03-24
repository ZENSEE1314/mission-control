@echo off
title Ruflo Mission Control — Setup
color 0B
echo.
echo  ========================================
echo   Ruflo Mission Control — First-Time Setup
echo  ========================================
echo.

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
  echo  [!] Node.js not found. Please install from https://nodejs.org
  pause
  exit /b 1
)
echo  [OK] Node.js found:
node --version

:: Install ruflo globally
echo.
echo  [1/3] Installing ruflo globally (this may take a minute)...
npm install -g ruflo
if %errorlevel% neq 0 (
  echo  [WARN] ruflo install failed - trying claude-flow directly...
  npm install -g claude-flow
)

:: Install dashboard dependencies
echo.
echo  [2/3] Installing Mission Control dependencies...
cd /d "%~dp0"
npm install

:: Init ruflo in the tasks folder
echo.
echo  [3/3] Initialising ruflo...
cd /d "%~dp0"
npx claude-flow init --codex 2>nul || echo  [INFO] ruflo init skipped (run manually if needed)

echo.
echo  ========================================
echo   Setup complete!  Run start.bat to begin.
echo  ========================================
echo.
pause
