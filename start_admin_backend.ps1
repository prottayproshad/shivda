# Admin Dashboard Backend Starter
# This script installs dependencies and starts the backend server

Write-Host "================================" -ForegroundColor Green
Write-Host "Admin Dashboard Backend Starter" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

# Check if Python is installed
$pythonCheck = python --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Python is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Python from: https://www.python.org" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit
}

Write-Host "✓ Python found: $pythonCheck" -ForegroundColor Green
Write-Host ""

# Install requirements
Write-Host "Installing dependencies from requirements.txt..." -ForegroundColor Yellow
python -m pip install -r requirements.txt

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
}

Write-Host ""
Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green
Write-Host ""
Write-Host "Starting Admin Dashboard Backend..." -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 INSTRUCTIONS:" -ForegroundColor Cyan
Write-Host "1. Open admin-dashboard.html in your browser" -ForegroundColor White
Write-Host "2. The dashboard will show 'Backend connected' if successful" -ForegroundColor White
Write-Host "3. KEEP THIS WINDOW OPEN while editing your website" -ForegroundColor Yellow
Write-Host "4. To stop: Press Ctrl+C" -ForegroundColor White
Write-Host ""
Write-Host "Starting server on http://localhost:5000" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

# Start the backend
python admin_backend.py

Write-Host ""
Write-Host "Backend stopped." -ForegroundColor Yellow
Read-Host "Press Enter to exit"
