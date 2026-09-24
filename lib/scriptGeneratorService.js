/**
 * scriptGeneratorService.js
 * Generador dinámico de scripts PowerShell para auditoría e instalación interactiva
 * de controladores oficiales en equipos cliente de la flota corporativa (Lenovo y HP).
 * Sin emojis, compatible con PowerShell 5.1 y 7+, compatible con ejecución directa irm | iex.
 */

'use strict';

/**
 * Genera el script PowerShell completo adaptado al modelo y lista de drivers.
 * 
 * @param {string} oem - 'lenovo' o 'hp'
 * @param {string} modelId - Código del modelo (ej. '20L5', '888A')
 * @param {string} modelName - Nombre amigable del modelo (ej. 'ThinkPad T480')
 * @param {Array} drivers - Catálogo oficial de drivers
 * @returns {string} Código PowerShell listo para ejecutar
 */
function generatePowerShellScript(oem, modelId, modelName, drivers) {
  const oemTitle = oem.toLowerCase() === 'hp' ? 'HP' : 'Lenovo';
  const cleanDrivers = (drivers || []).map(d => ({
    id:          d.id || '',
    name:        d.name || '',
    category:    d.category || 'Sistema',
    version:     d.version || '1.0.0.0',
    severity:    d.severity || 'Recomendado',
    isAdmitted:  d.windowsAdmitted !== false && d.deliverySource !== 'oem_only',
    winName:     d.windowsAdmittedName || d.name,
    downloadUrl: d.downloadUrl || '',
    fileSize:    d.fileSize || 'N/A',
  }));

  const driversJson = JSON.stringify(cleanDrivers);

  return `# ================================================================
# OEM Driver Auditor — Script de Auditoria e Instalacion Local
# Fabricante: ${oemTitle} | Modelo: ${modelName || modelId} (${modelId})
# Generado automaticamente por OEM Driver Explorer
# ================================================================

# Requiere privilegios de Administrador para auditar e instalar controladores
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host ""
    Write-Host "[!] AVISO: Este script requiere ejecutarse como Administrador para inspeccionar e instalar controladores." -ForegroundColor Yellow
    Write-Host "    Reiniciando PowerShell con privilegios elevados..." -ForegroundColor Cyan
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command \`"$($MyInvocation.MyCommand.Definition)\`""
    exit
}

# Configuracion de consola y codificacion
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

$TargetOEM      = "${oemTitle}"
$TargetModelId  = "${modelId}"
$TargetModelName = "${modelName || modelId}"

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "  OEM DRIVER AUDITOR — AUDITORIA E INSTALACION DE FLOTA CORPORATIVA" -ForegroundColor Cyan
Write-Host "  Fabricante: $TargetOEM | Modelo Objetivo: $TargetModelName ($TargetModelId)" -ForegroundColor White
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Validacion de Hardware Local
Write-Host "[1/3] Identificando hardware local del equipo..." -ForegroundColor Yellow
$localComputer = Get-CimInstance Win32_ComputerSystem
$localBoard    = Get-CimInstance Win32_BaseBoard
$localBios     = Get-CimInstance Win32_Bios

$detectedModel = ""
$isMatch = $false

if ($TargetOEM -eq "Lenovo") {
    $rawModel = $localComputer.Model
    $detectedModel = if ($rawModel.Length -ge 4) { $rawModel.Substring(0,4) } else { $rawModel }
    $isMatch = ($detectedModel -eq $TargetModelId) -or ($rawModel -like "*$TargetModelId*")
    Write-Host "      Equipo Lenovo detectado: $rawModel (MachineType: $detectedModel)" -ForegroundColor Gray
} else {
    $detectedModel = $localBoard.Product
    $isMatch = ($detectedModel -eq $TargetModelId) -or ($localComputer.Model -like "*$TargetModelId*")
    Write-Host "      Equipo HP detectado: $($localComputer.Model) (Board ID: $detectedModel)" -ForegroundColor Gray
}

Write-Host "      Version de BIOS actual: $($localBios.SMBIOSBIOSVersion) ($($localBios.ReleaseDate.ToString('yyyy-MM-dd')))" -ForegroundColor Gray

if (-not $isMatch) {
    Write-Host ""
    Write-Host "AVISO: El modelo de este equipo ($detectedModel) no coincide con el objetivo ($TargetModelId)." -ForegroundColor Red
    Write-Host "       Continuar puede instalar controladores incompatibles." -ForegroundColor Yellow
    $confirmMismatch = Read-Host "Deseas continuar bajo tu propia responsabilidad? (s/N)"
    if ($confirmMismatch -ne "s" -and $confirmMismatch -ne "S") {
        Write-Host "Operacion cancelada por el usuario." -ForegroundColor Gray
        exit
    }
} else {
    Write-Host "      (OK) Hardware verificado y compatible con el catalogo oficial." -ForegroundColor Green
}

# 2. Catalogo oficial embebido
$RawCatalogJson = @'
${driversJson}
'@

$OfficialCatalog = $RawCatalogJson | ConvertFrom-Json

# 3. Inventario de Controladores Instalados en Windows
Write-Host ""
Write-Host "[2/3] Escaneando controladores instalados en Windows (Plug and Play)..." -ForegroundColor Yellow

$installedDrivers = Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.DeviceName -or $_.Description }

function Normalize-Ver($v) {
    if (-not $v) { return [version]"0.0.0.0" }
    $clean = ($v -replace '[^0-9.]', '').Trim('.')
    $parts = $clean.Split('.')
    while ($parts.Count -lt 2) { $parts += "0" }
    if ($parts.Count -gt 4) { $parts = $parts | Select-Object -First 4 }
    try {
        return [version]($parts -join '.')
    } catch {
        return [version]"0.0.0.0"
    }
}

# Evaluar cada controlador del catalogo
$auditResults = @()
$counter = 1

foreach ($target in $OfficialCatalog) {
    $targetVerObj = Normalize-Ver $target.version
    $bestMatch = $null
    $bestMatchVer = [version]"0.0.0.0"

    # Buscar coincidencia en controladores instalados
    $nameKeywords = ($target.name -split '[\\s\\-_]+' | Where-Object { $_.Length -ge 4 -and $_ -notmatch 'driver|windows|thinkpad|intel|realtek|update|package|utility' })

    foreach ($inst in $installedDrivers) {
        $devName = "$($inst.DeviceName) $($inst.Description)"
        $matchedWord = $false
        foreach ($kw in $nameKeywords) {
            if ($devName -like "*$kw*") {
                $matchedWord = $true
                break
            }
        }

        if ($matchedWord) {
            $curVer = Normalize-Ver $inst.DriverVersion
            if ($curVer -ge $bestMatchVer) {
                $bestMatch = $inst
                $bestMatchVer = $curVer
            }
        }
    }

    $status = "PENDIENTE"
    $statusColor = "Red"
    $installedVerStr = if ($bestMatch) { $bestMatch.DriverVersion } else { "No detectado" }

    if ($bestMatch) {
        if ($bestMatchVer -ge $targetVerObj) {
            $status = "ACTUALIZADO"
            $statusColor = "Green"
        } else {
            $status = "DESACTUALIZADO"
            $statusColor = "Yellow"
        }
    }

    $auditResults += [PSCustomObject]@{
        Index        = $counter
        Name         = $target.name
        Category     = $target.category
        TargetVer    = $target.version
        InstalledVer = $installedVerStr
        Status       = $status
        Severity     = $target.severity
        IsAdmitted   = $target.isAdmitted
        DownloadUrl  = $target.downloadUrl
        FileSize     = $target.fileSize
    }
    $counter++
}

# 4. Mostrar Resultados de la Auditoria
Clear-Host
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "  REPORTE DE AUDITORIA LOCAL — $TargetModelName ($TargetModelId)" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan

$totalCount    = $auditResults.Count
$uptodateCount = ($auditResults | Where-Object { $_.Status -eq "ACTUALIZADO" }).Count
$outdatedCount = ($auditResults | Where-Object { $_.Status -eq "DESACTUALIZADO" }).Count
$pendingCount  = ($auditResults | Where-Object { $_.Status -eq "PENDIENTE" }).Count

Write-Host "  Controladores en catalogo : $totalCount" -ForegroundColor White
Write-Host "  Al dia / Actualizados     : $uptodateCount" -ForegroundColor Green
Write-Host "  Requieren actualizacion   : $outdatedCount" -ForegroundColor Yellow
Write-Host "  Pendientes / No instalados: $pendingCount" -ForegroundColor Red
Write-Host "--------------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host ("{0,-3} {1,-18} {2,-32} {3,-12} {4,-12} {5,-12}" -f "#", "CATEGORIA", "CONTROLADOR", "INSTALADO", "OFICIAL", "ESTADO") -ForegroundColor Cyan
Write-Host "--------------------------------------------------------------------------------" -ForegroundColor Gray

foreach ($r in $auditResults) {
    $color = "White"
    if ($r.Status -eq "ACTUALIZADO")   { $color = "Green" }
    if ($r.Status -eq "DESACTUALIZADO") { $color = "Yellow" }
    if ($r.Status -eq "PENDIENTE")     { $color = "Red" }

    $shortName = if ($r.Name.Length -gt 30) { $r.Name.Substring(0, 29) + "…" } else { $r.Name }
    $shortCat  = if ($r.Category.Length -gt 16) { $r.Category.Substring(0, 15) + "…" } else { $r.Category }

    Write-Host ("{0,-3} {1,-18} {2,-32} {3,-12} {4,-12} {5,-12}" -f $r.Index, $shortCat, $shortName, $r.InstalledVer, $r.TargetVer, $r.Status) -ForegroundColor $color
}

Write-Host "--------------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host ""

# 5. Menu de Acciones Interactivas
Write-Host "OPCIONES DISPONIBLES:" -ForegroundColor Cyan
Write-Host "  [1] Instalar AUTOMATICAMENTE todas las actualizaciones (Desactualizados y Pendientes)" -ForegroundColor White
Write-Host "  [2] Instalar UNICAMENTE actualizaciones criticas de Seguridad" -ForegroundColor White
Write-Host "  [3] Seleccionar manualmente que controladores instalar" -ForegroundColor White
Write-Host "  [4] Guardar reporte de auditoria en el Escritorio (auditoria-$TargetModelId.txt)" -ForegroundColor White
Write-Host "  [Q] Salir sin instalar nada" -ForegroundColor Gray
Write-Host ""

$choice = Read-Host "Elige una opcion (1-4 o Q)"

function Install-Package($item) {
    if (-not $item.DownloadUrl) {
        Write-Host "  [-] $($item.Name): Sin enlace directo de descarga oficial." -ForegroundColor Yellow
        return
    }

    $tempDir = Join-Path $env:TEMP "OEMDriverAuditor"
    if (-not (Test-Path $tempDir)) { New-Item -ItemType Directory -Path $tempDir -Force | Out-Null }

    $fileName = [System.IO.Path]::GetFileName($item.DownloadUrl)
    if (-not $fileName) { $fileName = "driver-$($item.Index).exe" }
    $targetFile = Join-Path $tempDir $fileName

    Write-Host ""
    Write-Host ">> Descargando: $($item.Name) ($($item.FileSize))..." -ForegroundColor Cyan
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
        $webClient = New-Object System.Net.WebClient
        $webClient.DownloadFile($item.DownloadUrl, $targetFile)
        Write-Host "   [OK] Descarga completada: $fileName" -ForegroundColor Green
    } catch {
        Write-Host "   [ERROR] Error al descargar: $($_.Exception.Message)" -ForegroundColor Red
        return
    }

    Write-Host ">> Instalando en modo desatendido/silencioso..." -ForegroundColor Cyan
    try {
        # Argumentos silenciosos estandar segun extension
        $args = "/VERYSILENT /NORESTART /SUPPRESSMSGBOXES"
        if ($targetFile -like "*.msi") {
            $proc = Start-Process msiexec.exe -ArgumentList "/i \`"$targetFile\`" /qn /norestart" -Wait -PassThru
        } else {
            $proc = Start-Process $targetFile -ArgumentList $args -Wait -PassThru
        }

        if ($proc.ExitCode -eq 0 -or $proc.ExitCode -eq 3010) {
            Write-Host "   [EXITO] Controlador instalado correctamente (ExitCode: $($proc.ExitCode))." -ForegroundColor Green
        } else {
            Write-Host "   [AVISO] El instalador finalizo con codigo: $($proc.ExitCode)." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   [ERROR] Fallo al ejecutar el instalador: $($_.Exception.Message)" -ForegroundColor Red
    }
}

if ($choice -eq "1") {
    $toInstall = $auditResults | Where-Object { $_.Status -ne "ACTUALIZADO" }
    Write-Host ""
    Write-Host "Iniciando instalacion de $($toInstall.Count) controladores..." -ForegroundColor Cyan
    foreach ($item in $toInstall) {
        Install-Package $item
    }
    Write-Host ""
    Write-Host "[FINALIZADO] Proceso de instalacion concluido." -ForegroundColor Green
}
elseif ($choice -eq "2") {
    $toInstall = $auditResults | Where-Object { $_.Status -ne "ACTUALIZADO" -and $_.Severity -eq "Critico" }
    Write-Host ""
    Write-Host "Iniciando instalacion de $($toInstall.Count) controladores criticos..." -ForegroundColor Cyan
    foreach ($item in $toInstall) {
        Install-Package $item
    }
    Write-Host ""
    Write-Host "[FINALIZADO] Controladores criticos instalados." -ForegroundColor Green
}
elseif ($choice -eq "3") {
    Write-Host ""
    Write-Host "Indica los numeros de los controladores a instalar separados por comas (ej. 1, 4, 7):" -ForegroundColor Cyan
    $selInput = Read-Host "Indices"
    $selectedIndices = $selInput.Split(',') | ForEach-Object { [int]$_.Trim() }

    $toInstall = $auditResults | Where-Object { $selectedIndices -contains $_.Index }
    Write-Host ""
    Write-Host "Instalando $($toInstall.Count) controladores seleccionados..." -ForegroundColor Cyan
    foreach ($item in $toInstall) {
        Install-Package $item
    }
    Write-Host ""
    Write-Host "[FINALIZADO] Instalacion manual completada." -ForegroundColor Green
}
elseif ($choice -eq "4") {
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $outFile = Join-Path $desktopPath "auditoria-$TargetModelId-$((Get-Date).ToString('yyyyMMdd-HHmmss')).txt"
    $auditResults | Format-Table -AutoSize | Out-File -FilePath $outFile -Encoding UTF8
    Write-Host ""
    Write-Host "[OK] Reporte guardado en tu escritorio: $outFile" -ForegroundColor Green
}
else {
    Write-Host ""
    Write-Host "Saliendo sin realizar cambios." -ForegroundColor Gray
}

Write-Host ""
Write-Host "Pulsa Enter para cerrar esta ventana..." -ForegroundColor Gray
Read-Host
`;
}

module.exports = {
  generatePowerShellScript,
};
