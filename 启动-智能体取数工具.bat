@echo off
setlocal enabledelayedexpansion
set "APP_ROOT=%~dp0"
set "PACKAGED_ROOT=%~dp0..\..\offline-package\ss-webcrawler-offline\"

rem If the zip was extracted as ss-webcrawler-offline\ss-webcrawler-offline,
rem let the launcher recover automatically.
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
  echo [ERROR] Electron runtime is missing. This offline package is incomplete.
  echo.
  echo Current launch directory:
  echo   %APP_ROOT%
  echo.
  echo Please check this file exists:
  echo   %APP_ROOT%node_modules\electron\dist\electron.exe
  echo.
  echo If it is missing, the zip was not fully extracted or security software removed electron.exe.
  echo Copy the full verified offline zip again, unzip it, and run this bat from the extracted folder.
  pause
  exit /b 1
)

if not exist "%APP_ROOT%dist\index.html" (
  echo [ERROR] dist is missing. Run node scripts\build-offline.mjs on the external network machine first.
  pause
  exit /b 1
)

set "APP_ENTRY=%APP_ROOT%dist-electron\index.js"

if not exist "%APP_ENTRY%" (
  echo [ERROR] dist-electron is missing. Run node scripts\build-offline.mjs on the external network machine first.
  pause
  exit /b 1
)

if defined SS_WEBCRAWLER_DEBUG_PORT (
  start "" /D "%APP_ROOT%" "%APP_ROOT%node_modules\electron\dist\electron.exe" --remote-debugging-port=%SS_WEBCRAWLER_DEBUG_PORT% "%APP_ENTRY%"
) else (
  start "" /D "%APP_ROOT%" "%APP_ROOT%node_modules\electron\dist\electron.exe" "%APP_ENTRY%"
)
