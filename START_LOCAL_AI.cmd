@echo off
set "OLLAMA_HOST=127.0.0.1:11434"
set "OLLAMA_NO_CLOUD=1"
set "OLLAMA_MODELS=%~dp0..\..\work\ollama\models"
set "OLLAMA_EXE=%~dp0..\..\work\ollama\runtime\ollama.exe"
if not exist "%OLLAMA_EXE%" (
  echo Local portable runtime is missing. See LOCAL_AI_GUIDE.md.
  exit /b 1
)
"%OLLAMA_EXE%" serve
