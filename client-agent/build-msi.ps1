# ==============================================================================
# Script de Compilación del Instalador MSI del Agente OEM Client
# Utiliza WiX Toolset para generar OEM-Client-Agent-1.0.0.msi
# ==============================================================================

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
if (-not $RootDir) { $RootDir = (Get-Item .).FullName }

$WixDir = "C:\Users\elfakir\AppData\Local\electron-builder\Cache\wix\wix-4.0.0.5512.2"
$Candle = Join-Path $WixDir "candle.exe"
$Light  = Join-Path $WixDir "light.exe"

if (-not (Test-Path $Candle) -or -not (Test-Path $Light)) {
    Write-Error "No se encontraron los ejecutables de WiX en: $WixDir"
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Compilando OEM Client Agent MSI v1.0.0                  " -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan

$SourceWxs = Join-Path $PSScriptRoot "agent.wxs"
$ObjFile   = Join-Path $PSScriptRoot "agent.wixobj"
$OutputMsi = Join-Path $PSScriptRoot "OEM-Client-Agent-1.0.0.msi"

# 1. Compilar WXS -> WIXOBJ
Write-Host "[1/3] Compilando codigo WiX con candle.exe..." -ForegroundColor Yellow
& $Candle -out $ObjFile $SourceWxs
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo la compilacion con candle.exe (Codigo de salida: $LASTEXITCODE)"
    exit $LASTEXITCODE
}

# 2. Enlazar WIXOBJ -> MSI
Write-Host "[2/3] Enlazando paquete MSI con light.exe..." -ForegroundColor Yellow
& $Light -out $OutputMsi -sval $ObjFile
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo el enlazado con light.exe (Codigo de salida: $LASTEXITCODE)"
    exit $LASTEXITCODE
}

# 3. Distribuir a ubicaciones clave
Write-Host "[3/3] Distribuyendo archivo MSI compilado..." -ForegroundColor Yellow

$PublicDownloadsDir = Join-Path $RootDir "public\downloads"
if (-not (Test-Path $PublicDownloadsDir)) {
    New-Item -ItemType Directory -Path $PublicDownloadsDir -Force | Out-Null
}

$WebMsiPath = Join-Path $PublicDownloadsDir "OEM-Client-Agent-1.0.0.msi"
Copy-Item -Path $OutputMsi -Destination $WebMsiPath -Force

$DesktopOemDir = "C:\Users\elfakir\Desktop\OEM"
if (Test-Path $DesktopOemDir) {
    $DesktopMsiPath = Join-Path $DesktopOemDir "OEM-Client-Agent-1.0.0.msi"
    Copy-Item -Path $OutputMsi -Destination $DesktopMsiPath -Force
    Write-Host "Copia guardada en el escritorio: $DesktopMsiPath" -ForegroundColor Green
}

# Limpiar archivos temporales
Remove-Item -Path $ObjFile -Force -ErrorAction SilentlyContinue
$PdbFile = [System.IO.Path]::ChangeExtension($OutputMsi, ".wixpdb")
if (Test-Path $PdbFile) { Remove-Item -Path $PdbFile -Force -ErrorAction SilentlyContinue }
$TestWxs = Join-Path $PSScriptRoot "test.wxs"
$TestWixObj = Join-Path $PSScriptRoot "test.wixobj"
$TestMsi = Join-Path $PSScriptRoot "test.msi"
Remove-Item -Path $TestWxs, $TestWixObj, $TestMsi -Force -ErrorAction SilentlyContinue

$msiSize = (Get-Item $OutputMsi).Length / 1KB
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  (OK) MSI generado exitosamente!                         " -ForegroundColor Green
Write-Host "  Archivo: $OutputMsi ($([Math]::Round($msiSize, 1)) KB)  " -ForegroundColor White
Write-Host "  Descarga Web: $WebMsiPath                               " -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Comando para despliegue silencioso en Microsoft Intune:" -ForegroundColor Cyan
Write-Host 'msiexec /i OEM-Client-Agent-1.0.0.msi /qn SERVER_URL="https://oem.elfakir.com"' -ForegroundColor White
Write-Host ""
