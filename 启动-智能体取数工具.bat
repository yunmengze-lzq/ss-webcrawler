@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules\electron\dist\electron.exe" (
  echo [ERROR] Electron runtime is missing. This offline package is incomplete.
  pause
  exit /b 1
)

if not exist "dist\index.html" (
  echo [ERROR] dist is missing. Run node scripts\build-offline.mjs on the external network machine first.
  pause
  exit /b 1
)

if not exist "dist-electron\index.js" (
  echo [ERROR] dist-electron is missing. Run node scripts\build-offline.mjs on the external network machine first.
  pause
  exit /b 1
)

start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0"
