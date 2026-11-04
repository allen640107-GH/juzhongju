@echo off
cd /d "%~dp0"
set "PORT=8765"
set "PAGE=http://127.0.0.1:%PORT%/"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
where py >nul 2>&1
if not errorlevel 1 start "juzhong" /min py -3 -m http.server %PORT% --bind 127.0.0.1
if errorlevel 1 start "juzhong" /min python -m http.server %PORT% --bind 127.0.0.1
ping -n 2 127.0.0.1 >nul
if exist "%CHROME%" start "" "%CHROME%" "%PAGE%" & exit /b 0
if exist "%EDGE%" start "" "%EDGE%" "%PAGE%" & exit /b 0
echo No Chrome or Edge found.
exit /b 1
