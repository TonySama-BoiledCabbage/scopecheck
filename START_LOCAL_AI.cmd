@echo off
set "OLLAMA_HOST=127.0.0.1:11434"
set "OLLAMA_NO_CLOUD=1"
set "OLLAMA_EXE=%~dp0..\..\work\ollama\runtime\ollama.exe"
if exist "%OLLAMA_EXE%" (
  set "OLLAMA_MODELS=%~dp0..\..\work\ollama\models"
  "%OLLAMA_EXE%" serve
  exit /b
)
where ollama >nul 2>nul
if errorlevel 1 (
  echo Ollama is not installed. See README.md. No models are downloaded by this script.
  exit /b 1
)
ollama serve
