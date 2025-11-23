@echo off
echo ========================================
echo Starting Altairium Grant Writing Tool
echo ========================================
echo.

echo [1/2] Starting Frontend (React + Vite)...
start "Frontend - Port 5173" cmd /k "cd /d %~dp0 && npm run dev"
timeout /t 2 /nobreak >nul

echo [2/2] Starting Python PDF Service...
start "Python Service - Port 8000" cmd /k "cd /d %~dp0src\backend && python -m uvicorn pyscrapepdf_utils:app --reload --port 8000"
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo All services started!
echo ========================================
echo.
echo Frontend:     http://localhost:5173
echo Python API:   http://localhost:8000
echo.
echo To process documents, run in a new terminal:
echo   cd src/backend
echo   node scrape.js
echo.
echo Press any key to exit this window...
pause >nul
