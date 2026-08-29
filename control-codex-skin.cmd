@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0control-codex-skin.ps1"
if errorlevel 1 (
  echo.
  echo The Control Center launcher failed to start.
  pause
)
endlocal
