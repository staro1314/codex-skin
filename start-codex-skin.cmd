@echo off
setlocal

rem Double-click entry point. Keep the PowerShell policy explicit and scoped
rem to this process; do not use an execution-policy bypass.
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0start-codex-skin.ps1" -PromptRestart
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Codex Dream Skin failed to start. Exit code: %EXIT_CODE%
  echo Close this window after reading the error, then retry.
  pause
)

exit /b %EXIT_CODE%
