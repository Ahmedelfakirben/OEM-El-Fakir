<#
    Agente Intune para OEM Driver Auditor (Lenovo)
    Se conecta al backend de OEM Driver Auditor (/api/agent/checkin)
#>

$ApiUrl = "https://oem.elfakir.com/api/agent/checkin"
$ApiKey = "cambia-esta-clave"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Debes ejecutar como Administrador"
    exit 1
}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# 1. Recopilar telemetría de hardware
$cs = Get-CimInstance Win32_ComputerSystem
$bios = Get-CimInstance Win32_BIOS
$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$bb = Get-CimInstance Win32_BaseBoard
$net = Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled -eq $true } | Select-Object -First 1

$ramGB = [math]::Round($os.TotalVisibleMemorySize / 1048576)
$mac = if ($net) { $net.MACAddress } else { "00:00:00:00:00:00" }
$deviceId = $bios.SerialNumber

# Para Lenovo, modelId suele ser los 4 primeros caracteres del modelo o BaseBoardProduct
$modelId = $cs.Model.Substring(0,4)
if ($bb.Product.Length -eq 4) { $modelId = $bb.Product }

# 2. Instalar LSUClient si falta
Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -ErrorAction SilentlyContinue | Out-Null
if (-not (Get-Module -ListAvailable "LSUClient")) {
    Install-Module "LSUClient" -Force -AllowClobber -Scope AllUsers -ErrorAction Stop
}
Import-Module "LSUClient" -Force

# 3. Escanear
Write-Output "Buscando actualizaciones Lenovo..."
$Pendientes = @(Get-LSUpdate -ErrorAction Stop)
$All = @(Get-LSUpdate -All -ErrorAction SilentlyContinue)
$Instalados = @($All | Where-Object { $_.IsInstalled -eq $true })

# 4. Formatear auditResults
$auditResults = @()

# Pendientes -> DESACTUALIZADO
foreach ($p in $Pendientes) {
    $sev = switch ($p.Severity) { 1 {"Crítico"} 2 {"Recomendado"} 3 {"Opcional"} default {"Opcional"} }
    $auditResults += @{
        name = $p.Title
        category = "Hardware"
        installedVer = "No detectado"
        targetVer = [string]($p.Version)
        severity = $sev
        status = "DESACTUALIZADO"
    }
}

# Instalados -> ACTUALIZADO
foreach ($i in $Instalados) {
    $sev = switch ($i.Severity) { 1 {"Crítico"} 2 {"Recomendado"} 3 {"Opcional"} default {"Opcional"} }
    $auditResults += @{
        name = $i.Title
        category = "Hardware"
        installedVer = [string]($i.Version)
        targetVer = [string]($i.Version)
        severity = $sev
        status = "ACTUALIZADO"
    }
}

# 5. Instalar Criticas
$ToInstall = $Pendientes | Where-Object { $_.Severity -eq 1 -or $_.Title -match 'Critical' }
foreach ($upd in $ToInstall) {
    try {
        Save-LSUpdate -Package $upd -ErrorAction Stop | Out-Null
        Install-LSUpdate -Package $upd -ErrorAction Stop | Out-Null
    } catch {}
}

# 6. Enviar a OEM Driver Auditor
$payload = @{
    deviceId = $deviceId
    hostname = $cs.Name
    oem = "lenovo"
    modelId = $modelId
    modelName = $cs.Model
    osBuild = $os.Version
    biosVersion = $bios.SMBIOSBIOSVersion
    cpu = $cpu.Name
    ram = "$ramGB GB"
    serialNumber = $bios.SerialNumber
    macAddress = $mac
    motherboard = $bb.Product
    osEdition = $os.Caption
    auditResults = $auditResults
}

$json = $payload | ConvertTo-Json -Depth 5 -Compress
Write-Output "Enviando check-in a OEM Driver Auditor..."
Invoke-RestMethod -Uri $ApiUrl -Method Post -Body ([Text.Encoding]::UTF8.GetBytes($json)) -ContentType "application/json" | Out-Null
Write-Output "Completado."
