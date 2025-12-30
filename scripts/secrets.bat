@echo off
REM =============================================================================
REM Pronghorn Secrets Generator - Windows Batch Script
REM =============================================================================
REM This script generates cryptographically secure secrets and updates .env
REM Usage: secrets.bat [--force]
REM =============================================================================

echo.
echo  ======================================
echo   Pronghorn Secrets Generator v3.0.0
echo  ======================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Get the directory of this script
set SCRIPT_DIR=%~dp0

REM Check for --force flag
set FORCE_FLAG=
if "%1"=="--force" set FORCE_FLAG=--force
if "%1"=="-f" set FORCE_FLAG=--force

REM Run the Node.js secrets generator
node "%SCRIPT_DIR%generate-secrets.js" --write %FORCE_FLAG%

echo.
echo Done!
pause
