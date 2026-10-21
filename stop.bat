@echo off
chcp 65001 >nul
setlocal EnableExtensions
title PulseBet Studio - Durdur
cd /d "%~dp0"

set "PORT=3850"
set "FOUND=0"

echo.
echo  PulseBet Studio durduruluyor...
echo.

rem 1) 3850 portunu dinleyen sureci bul ve kapat
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  if not "%%P"=="0" (
    taskkill /PID %%P /T /F >nul 2>&1
    set "FOUND=1"
  )
)

rem 2) start.bat ile acilan kucultulmus sunucu penceresini de kapat
taskkill /FI "WINDOWTITLE eq PulseBet Server*" /T /F >nul 2>&1

ping 127.0.0.1 -n 2 >nul
netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo  [UYARI] Sunucu hala calisiyor gibi gorunuyor. Yonetici olarak tekrar deneyin.
  pause
  exit /b 1
)

if "%FOUND%"=="1" (
  echo  Sunucu kapatildi.
) else (
  echo  Calisan bir PulseBet sunucusu bulunamadi.
)
ping 127.0.0.1 -n 3 >nul
exit /b 0
