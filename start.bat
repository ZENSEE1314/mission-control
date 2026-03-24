@echo off
title Ruflo Mission Control
color 0B
echo.
echo  ====================================
echo   🌊  Ruflo Mission Control Starting…
echo  ====================================
echo.
cd /d "%~dp0"

:: Check if deps installed
if not exist "node_modules" (
  echo  [!] Dependencies not installed. Running install.bat first...
  call install.bat
)

echo  Starting server on http://localhost:3847
echo  Opening dashboard in your browser...
echo.
echo  Press CTRL+C to stop the server.
echo.

:: Open browser after short delay (background)
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3847/dashboard.html"

:: Start the server
node server.js
