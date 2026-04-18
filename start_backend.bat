@echo off
REM Simple Website Editor - Start Backend
REM This script starts the Flask backend server

echo ============================================
echo Starting Simple Website Editor Backend...
echo ============================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found!
    echo Please install Python 3 from python.org
    echo.
    pause
    exit /b 1
)

REM Check if required packages are installed
python -c "import flask, flask_cors, bs4" >nul 2>&1
if errorlevel 1 (
    echo Installing required packages...
    pip install flask flask-cors beautifulsoup4
)

echo.
echo Starting backend server...
echo Open index.html in your browser and login with: admin / admin123
echo.
python simple_admin_backend.py

pause
