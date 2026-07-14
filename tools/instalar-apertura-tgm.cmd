@echo off
setlocal
set "INSTALLER=%~dp0install-tgm-open-protocol.ps1"

if not exist "%INSTALLER%" (
  echo No se encuentra install-tgm-open-protocol.ps1 junto a este archivo.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%INSTALLER%" -AllowedRoots "\\STINKOR\Oftecnica" %*
if errorlevel 1 (
  echo.
  echo No se pudo instalar la apertura de archivos TGM.
  pause
  exit /b 1
)

echo.
echo Instalacion terminada. Ya puedes abrir Excel y CAD desde la web.
pause
