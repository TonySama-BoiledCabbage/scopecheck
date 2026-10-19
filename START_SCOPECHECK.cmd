@echo off
cd /d "%~dp0"
if not exist .env.local copy .env.example .env.local >nul
if not exist node_modules\vite\bin\vite.js (
  echo Dependencies missing. Run npm ci in this directory first.
  exit /b 1
)
call npm run dev
