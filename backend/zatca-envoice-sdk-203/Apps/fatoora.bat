@echo off
setlocal

if not defined FATOORA_HOME set "FATOORA_HOME=%~dp0"
if not "%FATOORA_HOME:~-1%"=="\" set "FATOORA_HOME=%FATOORA_HOME%\"

:: Read version and certPassword from global.json (no jq required)
for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-Content -Raw '%FATOORA_HOME%global.json' | ConvertFrom-Json).version"') do set "VAR=%%i"
for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-Content -Raw '%FATOORA_HOME%global.json' | ConvertFrom-Json).certPassword"') do set "CERT_PASS=%%i"

set "VAR=%VAR:~1,-1%"
set "CERT_PASS=%CERT_PASS:~1,-1%"

set "JAR=%FATOORA_HOME%cli-%VAR%-jar-with-dependencies.jar"
if not exist "%JAR%" (
  echo JAR not found: %JAR%
  echo Place the ZATCA SDK CLI JAR from the Developer Portal in Apps\ folder.
  exit /b 1
)

java -Djdk.module.illegalAccess=deny -Dfile.encoding=UTF-8 -jar "%JAR%" --globalVersion %VAR% -certpassword %CERT_PASS% %*
endlocal
