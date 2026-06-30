@echo off
TITLE Amana Diagnostics Local LAN Hub
color 0A
clear

echo =====================================================================
echo  AMANA DIAGNOSTICS LOCAL LAN HUB
echo =====================================================================
echo.
echo [1] Detecting Server PC IP Address...

:: Detect active local IPv4 address
for /f "tokens=4 delims= " %%i in ('route print ^| findstr 0.0.0.0 ^| findstr /v "127.0.0.1"') do (
    set IP_TEMP=%%i
)
:: Trim leading space
set LOCAL_IP=%IP_TEMP: =%

if "%LOCAL_IP%"=="" (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| find "IPv4 Address"') do (
        set LOCAL_IP=%%a
      )
)
:: Remove spaces
set LOCAL_IP=%LOCAL_IP: =%

echo.
echo  --^> Hub Server PC IP:  %LOCAL_IP%
echo.
echo =====================================================================
echo  CLINIC STAFF CONNECTION INSTRUCTIONS
echo =====================================================================
echo.
echo  1. Connect all clinic laptops (Reception, Lab, Radiology) to the same Wi-Fi router.
echo  2. Open the browser on each laptop and type the following address:
echo.
echo         --->   http://%LOCAL_IP%:3000   <---
echo.
echo  3. To access this Server PC itself locally, you can open:
echo.
echo         --->   http://localhost:3000   <---
echo.
echo  * CRITICAL: Do NOT close this window. Closing it will shut down the
echo    server database and disconnect all other laptops in the clinic.
echo =====================================================================
echo.
echo [2] Starting database server in Local LAN mode...
echo.

set NEXT_PUBLIC_LOCAL_SERVER_MODE=true
npx next dev -H 0.0.0.0 -p 3000
pause
