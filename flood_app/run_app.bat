@echo off
setlocal enabledelayedexpansion
title Aqualert Emergency Response System
cd /d "%~dp0"

:: 0. Automatically unblock all project files from Windows Mark-of-the-Web
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '%~dp0' -Recurse | Unblock-File" >nul 2>&1

echo ========================================================
echo   AQUALERT: AUTONOMOUS CRISIS RESPONSE SYSTEM
echo   Automated Launcher and Dependency Manager
echo ========================================================
echo.

:: 1. Search for existing Python installation
set "PY_CMD="

python -c "import sys" >nul 2>&1
if !errorlevel! equ 0 (
    set "PY_CMD=python"
    goto found_python
)

py -c "import sys" >nul 2>&1
if !errorlevel! equ 0 (
    set "PY_CMD=py"
    goto found_python
)

:: Check standard local user and system Python paths
for %%P in (
    "%LocalAppData%\Programs\Python\Python312\python.exe"
    "%LocalAppData%\Programs\Python\Python311\python.exe"
    "%LocalAppData%\Programs\Python\Python310\python.exe"
    "C:\Python312\python.exe"
    "C:\Python311\python.exe"
    "C:\Program Files\Python312\python.exe"
    "C:\Program Files\Python311\python.exe"
) do (
    if exist "%%~P" (
        "%%~P" -c "import sys" >nul 2>&1
        if !errorlevel! equ 0 (
            set "PY_CMD=%%~P"
            goto found_python
        )
    )
)

:: 2. Python is not installed - Automatically install it for the tester
echo [!] Python is not currently installed on this system.
echo [*] Downloading and installing Python automatically...
echo.

:: Try Windows Package Manager (winget) first if available
where winget >nul 2>&1
if !errorlevel! equ 0 (
    echo [*] Installing Python 3.12 via Windows Package Manager (winget)...
    winget install --id Python.Python.3.12 -e --silent --accept-source-agreements --accept-package-agreements
)

:: Check if winget successfully installed it
for %%P in (
    "%LocalAppData%\Programs\Python\Python312\python.exe"
    "%LocalAppData%\Programs\Python\Python311\python.exe"
    "C:\Program Files\Python312\python.exe"
) do (
    if exist "%%~P" (
        set "PY_CMD=%%~P"
        goto found_python
    )
)

:: Fallback: Download official Python installer using PowerShell
if not defined PY_CMD (
    echo [*] Downloading official Python 3.12 installer from python.org...
    set "INSTALLER=%TEMP%\python_312_installer.exe"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://www.python.org/ftp/python/3.12.6/python-3.12.6-amd64.exe', '%INSTALLER%')"
    
    if exist "%INSTALLER%" (
        echo [*] Installing Python silently in user profile (no admin rights needed)...
        "%INSTALLER%" /quiet InstallAllUsers=0 PrependPath=1 Include_pip=1 SimpleInstall=1
        timeout /t 5 >nul 2>&1
        del "%INSTALLER%" >nul 2>&1
    )
)

:: Re-verify Python path after installer
for %%P in (
    "%LocalAppData%\Programs\Python\Python312\python.exe"
    "%LocalAppData%\Programs\Python\Python311\python.exe"
    "C:\Python312\python.exe"
) do (
    if exist "%%~P" (
        set "PY_CMD=%%~P"
        goto found_python
    )
)

python -c "import sys" >nul 2>&1
if !errorlevel! equ 0 (
    set "PY_CMD=python"
    goto found_python
)

if not defined PY_CMD (
    echo.
    echo [ERROR] Could not install Python automatically.
    echo Please install Python manually from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

:found_python
echo [*] Python interpreter ready: !PY_CMD!

:: 3. Check and auto-install Python packages (FastAPI and Uvicorn)
echo [*] Verifying application dependencies...
!PY_CMD! -c "import fastapi, uvicorn" >nul 2>&1
if !errorlevel! neq 0 (
    echo [*] Installing required packages: fastapi and uvicorn...
    !PY_CMD! -m pip install fastapi uvicorn
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install packages via pip.
        pause
        exit /b 1
    )
)

echo [*] All dependencies are ready.
echo [*] Launching Aqualert Dashboard...
echo ========================================================
echo.

!PY_CMD! main.py

if !errorlevel! neq 0 (
    echo.
    echo [!] Application exited with an error code.
    pause
)
