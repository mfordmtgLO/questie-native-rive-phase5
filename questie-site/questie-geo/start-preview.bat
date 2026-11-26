@echo off
setlocal
cd /d "%~dp0"
where py.exe >nul 2>&1
if not errorlevel 1 goto use_py
where python.exe >nul 2>&1
if not errorlevel 1 goto use_python
goto use_powershell
:use_py
py -3 "%~dp0serve.py"
if not errorlevel 1 exit /b 0
goto use_powershell
:use_python
python "%~dp0serve.py"
if not errorlevel 1 exit /b 0
:use_powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-preview.ps1"
exit /b %errorlevel%
