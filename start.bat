@echo off
echo ========================================================
echo Starting Second Opinion AI Auditing Platform...
echo ========================================================
start "Second Opinion Backend (Port 8000)" cmd /k ".\venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"
timeout /t 2 /nobreak >nul
start "Second Opinion Frontend (Port 5173)" cmd /k "cd frontend && npm run dev"
echo.
echo Both servers have been launched!
echo - Frontend: http://127.0.0.1:5173
echo - Backend API: http://127.0.0.1:8000/docs
echo ========================================================
