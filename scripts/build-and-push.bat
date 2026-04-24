@echo off
chcp 65001 >nul
cd /d "%~dp0\.."
powershell -ExecutionPolicy Bypass -File "%~dp0build-and-push.ps1" %*
pause
