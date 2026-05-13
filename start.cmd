@echo off
setlocal enabledelayedexpansion
set "APP_ROOT=%~dp0"
set "PACKAGED_ROOT=%~dp0..\..\offline-package\ss-webcrawler-offline\"

if not exist "%APP_ROOT%node_modules\electron\dist\electron.exe" (
  if exist "%PACKAGED_ROOT%node_modules\electron\dist\electron.exe" (
    set "APP_ROOT=%PACKAGED_ROOT%"
  )
)

if not exist "%APP_ROOT%node_modules\electron\dist\electron.exe" (
  if exist "%APP_ROOT%ss-webcrawler-offline\node_modules\electron\dist\electron.exe" (
    set "APP_ROOT=%APP_ROOT%ss-webcrawler-offline\"
  )
)

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
  pause
  exit /b 1
)

set "APP_ENTRY=%APP_ROOT%dist-electron\index.js"
if not exist "%APP_ENTRY%" (
  echo [ERROR] dist-electron\index.js is missing.
  pause
  exit /b 1
)

set "APP_URL=file:///%APP_ROOT:\=/%dist/index.html"
set "VITE_DEV_SERVER_URL=%APP_URL%"

start "" /D "%APP_ROOT%" "%APP_ROOT%node_modules\electron\dist\electron.exe" "%APP_ENTRY%"
