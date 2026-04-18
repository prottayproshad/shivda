@echo off
REM Admin Dashboard Backend Starter (Batch version)
REM This script starts the admin backend server

echo.
echo ================================
echo Admin Dashboard Backend Starter
echo ================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python from: https://www.python.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo.
echo ✓ Python found: %PYTHON_VERSION%
echo.

REM Install requirements
echo Installing dependencies from requirements.txt...
python -m pip install -q -r requirements.txt

if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ✓ Dependencies installed successfully
echo.
echo Starting Admin Dashboard Backend...
echo ================================
echo.
echo INSTRUCTIONS:
echo 1. Open admin-dashboard.html in your browser
echo 2. The dashboard will show 'Backend connected' if successful
echo 3. KEEP THIS WINDOW OPEN while editing your website
echo 4. To stop: Press Ctrl+C
echo.
echo Starting server on http://localhost:5000
echo ================================
echo.

python admin_backend.py

echo.
echo Backend stopped.
pause
