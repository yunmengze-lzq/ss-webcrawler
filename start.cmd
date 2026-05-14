@echo off
setlocal
set "APP_ROOT=%~dp0"
cd /d "%APP_ROOT%"

if not exist "%APP_ROOT%node_modules\electron\dist\electron.exe" (
  echo [ERROR] Electron runtime is missing.
  echo Current launch directory:
  echo   %APP_ROOT%
  echo Expected file:
  echo   %APP_ROOT%node_modules\electron\dist\electron.exe
  pause
  exit /b 1
)

if not exist "%APP_ROOT%dist\index.html" (
  echo [ERROR] dist\index.html is missing.
  echo 请先在当前目录执行:
  echo   npm run build
  pause
  exit /b 1
)

set "APP_ENTRY=%APP_ROOT%dist-electron\index.js"
if not exist "%APP_ENTRY%" (
  echo [ERROR] dist-electron\index.js is missing.
  echo 请先在当前目录执行:
  echo   npm run build
  pause
  exit /b 1
)

start "" /D "%APP_ROOT%" "%APP_ROOT%node_modules\electron\dist\electron.exe" "%APP_ENTRY%"
