@echo off
setlocal EnableDelayedExpansion
SET "MY_PATH=%~dp0"

:: Set user environment variables (do not clear PATH)
setx SDK_CONFIG "%MY_PATH%Configuration\config.json"
setx FATOORA_HOME "%MY_PATH%Apps\"

:: Add Apps to PATH for current session only (setx PATH has length limits)
set "PATH=%MY_PATH%Apps\;%PATH%"

cd /d "%~dp0Configuration"

:: Build config.json with absolute paths using PowerShell (no jq required)
powershell -NoProfile -Command "$p = (Get-Item '..').FullName; $c = @{ xsdPath = (Join-Path $p 'Data\\Schemas\\xsds\\UBL2.1\\xsd\\maindoc\\UBL-Invoice-2.1.xsd'); enSchematron = (Join-Path $p 'Data\\Rules\\schematrons\\CEN-EN16931-UBL.xsl'); zatcaSchematron = (Join-Path $p 'Data\\Rules\\schematrons\\20210819_ZATCA_E-invoice_Validation_Rules.xsl'); certPath = (Join-Path $p 'Data\\Certificates\\cert.pem'); privateKeyPath = (Join-Path $p 'Data\\Certificates\\ec-secp256k1-priv-key.pem'); pihPath = (Join-Path $p 'Data\\PIH\\pih.txt'); certPassword = '123456789'; inputPath = (Join-Path $p 'Data\\Input'); usagePathFile = (Join-Path $p 'Configuration\\usage.txt') }; Set-Content -Path 'config.json' -Value (ConvertTo-Json $c) -Encoding UTF8"

cd /d "%~dp0"
echo.
echo ZATCA SDK environment configured.
echo SDK_CONFIG = %MY_PATH%Configuration\config.json
echo FATOORA_HOME = %MY_PATH%Apps\
echo.
echo To validate an invoice XML (after placing the JAR in Apps\):
echo   cd Apps
echo   fatoora.bat -validate -invoice "path\to\invoice.xml"
echo.
echo Ensure Java 21 or 22 is installed and on PATH.
endlocal
