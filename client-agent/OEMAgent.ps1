# ==============================================================================
# OEM Client Agent — Endpoint Hardware & Driver Telemetry Service
# Despliegue corporativo para Microsoft Intune / SCCM / GPO
# Version: 1.0.0
# ==============================================================================

[CmdletBinding()]
param (
    [string]$ServerUrl = "",
    [switch]$ForceInstall,
    [switch]$VerboseOutput
)

$ErrorActionPreference = "SilentlyContinue"
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13

# 1. Configuración y Logging
$AgentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $AgentDir) { $AgentDir = "C:\Program Files\OEMDriverAgent" }

$DataDir = "C:\ProgramData\OEMDriverAgent"
if (-not (Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir -Force | Out-Null }
$LogFile = Join-Path $DataDir "agent.log"
$ConfigFile = Join-Path $AgentDir "config.json"

function Write-AgentLog {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $entry = "[$timestamp] [$Level] $Message"
    try {
        Add-Content -Path $LogFile -Value $entry -Encoding UTF8
    } catch {}
    if ($VerboseOutput) {
        Write-Host $entry
    }
}

Write-AgentLog "Iniciando ciclo de telemetria del agente OEM Client..." "INFO"

# Cargar configuracion local si existe
if (Test-Path $ConfigFile) {
    try {
        $cfgJson = Get-Content $ConfigFile -Raw | ConvertFrom-Json
        if (-not $ServerUrl -and $cfgJson.ServerUrl) {
            $ServerUrl = $cfgJson.ServerUrl
        }
    } catch {
        Write-AgentLog "Error leyendo config.json: $($_.Exception.Message)" "WARN"
    }
}

if (-not $ServerUrl) {
    $ServerUrl = "http://localhost:3000"
}
$ServerUrl = $ServerUrl.TrimEnd('/')
Write-AgentLog "Servidor central configurado: $ServerUrl" "INFO"

# 2. Recolección de Telemetría de Hardware y Sistema
try {
    $cs = Get-CimInstance Win32_ComputerSystem
    $bb = Get-CimInstance Win32_BaseBoard
    $bios = Get-CimInstance Win32_Bios
    $os = Get-CimInstance Win32_OperatingSystem
    $proc = Get-CimInstance Win32_Processor | Select-Object -First 1
    $mem = Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum
    $csp = Get-CimInstance Win32_ComputerSystemProduct
    $net = Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled -eq $true } | Select-Object -First 1

    # Identificar fabricante y modelo
    $manufacturer = if ($cs.Manufacturer) { $cs.Manufacturer.Trim() } else { "Desconocido" }
    $oem = "lenovo"
    if ($manufacturer -match "HP|Hewlett-Packard") {
        $oem = "hp"
    } elseif ($manufacturer -match "Dell") {
        $oem = "dell"
    }

    $modelId = ""
    if ($oem -eq "lenovo") {
        $modelId = if ($cs.Model.Length -ge 4) { $cs.Model.Substring(0,4) } else { $cs.Model }
    } else {
        $modelId = if ($bb.Product) { $bb.Product.Trim() } else { $cs.Model }
    }

    $modelName = if ($cs.Model) { $cs.Model } else { "PC Corporativo" }
    $hostname = $env:COMPUTERNAME
    $serialNumber = if ($bios.SerialNumber) { $bios.SerialNumber.Trim() } else { $csp.IdentifyingNumber }
    $deviceId = if ($csp.UUID -and $csp.UUID -ne "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF") { $csp.UUID } else { "$hostname-$modelId" }

    $cpuName = if ($proc.Name) { $proc.Name.Trim() } else { "CPU no detectado" }
    $ramGB = if ($mem.Sum) { "$([Math]::Round($mem.Sum / 1GB, 1)) GB" } else { "N/A" }
    $motherboard = "$($bb.Manufacturer) $($bb.Product)".Trim()
    $osEdition = if ($os.Caption) { $os.Caption.Trim() } else { "Windows 11" }
    $osBuild = if ($os.BuildNumber) { "Build $($os.BuildNumber)" } else { "24H2" }
    $biosVer = if ($bios.SMBIOSBIOSVersion) { $bios.SMBIOSBIOSVersion.Trim() } else { "N/A" }
    $macAddr = if ($net.MACAddress) { $net.MACAddress } else { "N/A" }
    $ipAddr = if ($net.IPAddress) { $net.IPAddress[0] } else { "127.0.0.1" }

    Write-AgentLog "Equipo: $hostname | OEM: $oem | Modelo: $modelName ($modelId) | Serie: $serialNumber | RAM: $ramGB" "INFO"
} catch {
    Write-AgentLog "Error recolectando telemetria: $($_.Exception.Message)" "ERROR"
}

# 3. Auditoría de Controladores Locales e Inventario PnP
$auditResults = @()
try {
    Write-AgentLog "Consultando catalogo oficial en el servidor ($oem/$modelId)..." "INFO"
    $catalogUrl = "$ServerUrl/api/drivers/$oem/$modelId"
    $catalogResp = Invoke-RestMethod -Uri $catalogUrl -Method Get -TimeoutSec 20 -ErrorAction Stop

    $officialDrivers = if ($catalogResp.drivers) { $catalogResp.drivers } elseif ($catalogResp -is [System.Array]) { $catalogResp } else { @() }
    
    if ($officialDrivers.Count -gt 0) {
        Write-AgentLog "Catalogo recibido: $($officialDrivers.Count) controladores oficiales disponibles." "INFO"

        # Obtener controladores instalados en Windows
        $installedDrivers = Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.DeviceName -and $_.DriverVersion }

        foreach ($official in $officialDrivers) {
            $matched = $null
            $offName = $official.name

            # Búsqueda difusa por palabras clave en los nombres de dispositivos instalados
            $matched = $installedDrivers | Where-Object { 
                $_.DeviceName -like "*$offName*" -or 
                $offName -like "*$($_.DeviceName)*" -or
                ($_.DriverProviderName -and $offName -like "*$($_.DriverProviderName)*")
            } | Select-Object -First 1

            # Búsqueda secundaria por categoría si no hubo match directo
            if (-not $matched -and $official.category) {
                $cat = $official.category.ToLower()
                if ($cat -match "video|gráfico|display") {
                    $matched = $installedDrivers | Where-Object { $_.DeviceClass -match "DISPLAY" -or $_.DeviceName -match "Intel.*Graphics|NVIDIA|Radeon|UHD|Iris" } | Select-Object -First 1
                } elseif ($cat -match "red|wifi|inalámb") {
                    $matched = $installedDrivers | Where-Object { $_.DeviceClass -match "NET" -and ($_.DeviceName -match "Wi-Fi|Wireless|802.11|Ethernet") } | Select-Object -First 1
                } elseif ($cat -match "audio|sonido") {
                    $matched = $installedDrivers | Where-Object { $_.DeviceClass -match "MEDIA" -or $_.DeviceName -match "Realtek|Audio|Sound" } | Select-Object -First 1
                } elseif ($cat -match "bios|uefi|firmware") {
                    $matched = $installedDrivers | Where-Object { $_.DeviceClass -match "FIRMWARE" -or $_.DeviceName -match "System Firmware|BIOS" } | Select-Object -First 1
                }
            }

            $installedVer = if ($matched -and $matched.DriverVersion) { $matched.DriverVersion.Trim() } else { "No detectado" }
            $targetVer = if ($official.version) { $official.version.Trim() } else { "1.0" }

            $status = "PENDIENTE"
            if ($installedVer -ne "No detectado") {
                if ($installedVer -eq $targetVer) {
                    $status = "ACTUALIZADO"
                } else {
                    $status = "DESACTUALIZADO"
                }
            }

            $auditResults += @{
                name = $official.name
                category = if ($official.category) { $official.category } else { "Sistema" }
                installedVersion = $installedVer
                targetVersion = $targetVer
                status = $status
                severity = if ($official.severity) { $official.severity } else { "Recomendado" }
                isAdmitted = ($official.windowsAdmitted -eq $true)
                downloadUrl = if ($official.downloadUrl) { $official.downloadUrl } else { "" }
                fileSize = if ($official.fileSize) { $official.fileSize } else { "N/A" }
            }
        }
        Write-AgentLog "Auditoria completada: $($auditResults.Count) controladores cotejados." "INFO"
    } else {
        Write-AgentLog "No se recibieron controladores del catalogo." "WARN"
    }
} catch {
    Write-AgentLog "Aviso al consultar catalogo OEM ($($_.Exception.Message))." "WARN"
}

# 4. Check-in con el Servidor Central
$checkinPayload = @{
    deviceId = $deviceId
    hostname = $hostname
    oem = $oem
    modelId = $modelId
    modelName = $modelName
    osBuild = "$osEdition $osBuild"
    osEdition = $osEdition
    biosVersion = $biosVer
    cpu = $cpuName
    ram = $ramGB
    serialNumber = $serialNumber
    macAddress = $macAddr
    motherboard = $motherboard
    auditResults = $auditResults
} | ConvertTo-Json -Depth 5

try {
    Write-AgentLog "Enviando check-in a $ServerUrl/api/agent/checkin..." "INFO"
    $checkinResp = Invoke-RestMethod -Uri "$ServerUrl/api/agent/checkin" -Method Post -Body $checkinPayload -ContentType "application/json; charset=utf-8" -TimeoutSec 15
    Write-AgentLog "Respuesta del servidor: Accion=$($checkinResp.action) Modo=$($checkinResp.mode) Mensaje=$($checkinResp.message)" "INFO"

    # 5. Ejecutar orden de instalacion si el servidor lo instruye
    if ($checkinResp.action -eq "install" -and $checkinResp.drivers) {
        $taskId = $checkinResp.taskId
        Write-AgentLog "Orden de instalacion recibida (Tarea ID: $taskId, Parches: $($checkinResp.drivers.Count))" "INFO"

        $cacheDir = Join-Path $DataDir "Cache"
        if (-not (Test-Path $cacheDir)) { New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null }

        $overallExitCode = 0
        $logOutput = ""

        foreach ($drv in $checkinResp.drivers) {
            $drvName = if ($drv.name) { $drv.name } elseif ($drv.driver_name) { $drv.driver_name } else { "Controlador" }
            $drvUrl = if ($drv.downloadUrl) { $drv.downloadUrl } elseif ($drv.download_url) { $drv.download_url } else { "" }
            Write-AgentLog "Descargando controlador: $drvName..." "INFO"
            if ($drvUrl) {
                try {
                    $fileName = [System.IO.Path]::GetFileName($drvUrl)
                    if (-not $fileName -or -not $fileName.Contains(".")) { $fileName = "patch_$($drv.id).exe" }
                    $destPath = Join-Path $cacheDir $fileName

                    # Descarga
                    Invoke-WebRequest -Uri $drvUrl -OutFile $destPath -TimeoutSec 120
                    Write-AgentLog "Archivo descargado en: $destPath. Ejecutando instalador silencioso..." "INFO"

                    # Ejecución silenciosa segun extension
                    $ext = [System.IO.Path]::GetExtension($destPath).ToLower()
                    $pinfo = New-Object System.Diagnostics.ProcessStartInfo
                    $pinfo.FileName = $destPath
                    $pinfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
                    $pinfo.CreateNoWindow = $true

                    if ($ext -eq ".msi") {
                        $pinfo.FileName = "msiexec.exe"
                        $pinfo.Arguments = "/i `"$destPath`" /qn /norestart"
                    } else {
                        # Switches estandar para instaladores OEM (InnoSetup, InstallShield, Wise)
                        $pinfo.Arguments = "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-"
                    }

                    $proc = [System.Diagnostics.Process]::Start($pinfo)
                    $proc.WaitForExit(600000) # Max 10 min por parche
                    $exitCode = $proc.ExitCode
                    Write-AgentLog "Instalador finalizo con codigo de salida: $exitCode" "INFO"
                    $logOutput += "[$drvName]: Codigo $exitCode`n"

                    if ($exitCode -ne 0 -and $exitCode -ne 3010) {
                        $overallExitCode = $exitCode
                    }
                } catch {
                    Write-AgentLog "Error instalando $drvName: $($_.Exception.Message)" "ERROR"
                    $logOutput += "[$drvName]: Error $($_.Exception.Message)`n"
                    $overallExitCode = 1
                }
            } else {
                Write-AgentLog "El controlador $drvName no dispone de URL directa de descarga." "WARN"
                $logOutput += "[$drvName]: Sin URL de descarga directa`n"
            }
        }

        # Reportar resultado de vuelta al servidor
        try {
            $reportPayload = @{
                taskId = $taskId
                exitCode = $overallExitCode
                logOutput = $logOutput
            } | ConvertTo-Json
            Invoke-RestMethod -Uri "$ServerUrl/api/agent/report" -Method Post -Body $reportPayload -ContentType "application/json"
            Write-AgentLog "Reporte de tarea $taskId enviado con exito al servidor." "INFO"
        } catch {
            Write-AgentLog "Error enviando reporte de tarea: $($_.Exception.Message)" "WARN"
        }
    }
} catch {
    Write-AgentLog "Fallo en comunicacion con el servidor: $($_.Exception.Message)" "ERROR"
}

Write-AgentLog "Ciclo de telemetria finalizado." "INFO"
