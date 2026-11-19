@echo off
setlocal
pushd "%~dp0" || exit /b 1
where node.exe >nul 2>nul
if errorlevel 1 goto browser
node.exe -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if errorlevel 1 goto browser
node.exe field-atlas-server.cjs --open
if errorlevel 1 pause
popd
exit /b
:browser
echo Opening the standalone dashboard. Install Node.js 22 or newer to enable the local search server.
start "" "index.html"
popd
endlocal
