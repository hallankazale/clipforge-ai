@echo off
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python nao encontrado. Instale Python 3.12 e marque Add Python to PATH.
  pause
  exit /b 1
)
start "" http://127.0.0.1:8787
python app.py
pause
