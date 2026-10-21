@echo off
chcp 65001 >nul
setlocal EnableExtensions
title PulseBet Studio - Baslat
cd /d "%~dp0"

set "PORT=3850"
set "HOST=127.0.0.1"
set "URL=http://%HOST%:%PORT%"

echo.
echo  ==========================================
echo    PulseBet Studio baslatiliyor...
echo  ==========================================
echo.

rem 1) Node.js kurulu mu?
where node >nul 2>&1
if errorlevel 1 (
  echo  [HATA] Node.js bulunamadi. https://nodejs.org adresinden kurup tekrar deneyin.
  echo.
  pause
  exit /b 1
)

rem 2) Zaten calisiyor mu?
netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo  Sunucu zaten calisiyor. Tarayici aciliyor...
  if not defined PULSEBET_NO_BROWSER start "" "%URL%"
  ping 127.0.0.1 -n 3 >nul
  exit /b 0
)

rem 3) Bagimliliklar eksikse yukle
if not exist "node_modules\ws" (
  echo  Bagimliliklar yukleniyor ^(ilk calistirma^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo  [HATA] npm install basarisiz oldu.
    pause
    exit /b 1
  )
)

if not exist "data" mkdir "data"

rem 4) Sunucuyu arka planda, kucultulmus pencerede baslat
start "PulseBet Server" /min node src\server.js

rem 5) Port acilana kadar bekle (en fazla ~30 sn)
set /a TRIES=0
:waitloop
ping 127.0.0.1 -n 2 >nul
set /a TRIES+=1
netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul 2>&1
if not errorlevel 1 goto ready
if %TRIES% GEQ 30 goto failed
goto waitloop

:ready
echo  Sunucu hazir: %URL%
if not defined PULSEBET_NO_BROWSER start "" "%URL%"
echo.
echo  Kapatmak icin "stop.bat" dosyasini calistirin.
ping 127.0.0.1 -n 3 >nul
exit /b 0

:failed
echo  [HATA] Sunucu 30 saniye icinde baslamadi. Ayrintilar: data\server.log
echo.
type "data\server.log"
echo.
pause
exit /b 1
