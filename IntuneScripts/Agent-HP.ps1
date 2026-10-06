<#
    Agente Intune para OEM Driver Auditor (HP)
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
$modelId = $bb.Product

# 2. Configurar HPIA
$HPIAPath = "$env:ProgramData\HP\HPIA"
$LogOfertado = "$HPIAPath\Logs\Ofertado"
$LogInstalado = "$HPIAPath\Logs\Instalado"
New-Item -ItemType Directory -Force $LogOfertado, $LogInstalado | Out-Null

$HPIAExe = Get-ChildItem -Path $HPIAPath -Filter "HPImageAssistant.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $HPIAExe) {
    Write-Output "HPIA no encontrado, descargando..."
    Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -ErrorAction SilentlyContinue | Out-Null
    if (-not (Get-Module "HPCMSL")) { Install-Module "HPCMSL" -Force -Scope AllUsers }
    Import-Module HPCMSL -Force
    Install-HPImageAssistant -Extract -DestinationPath $HPIAPath -Quiet
    $HPIAExe = Get-ChildItem -Path $HPIAPath -Filter "HPImageAssistant.exe" -Recurse | Select-Object -First 1
}

# 3. Analizar pendientes e instalados
Write-Output "Analizando HP..."
$ArgList = "/Operation:Analyze /Selection:All /Action:List /Silent /ReportFolder:`"$LogOfertado`""
Start-Process -FilePath $HPIAExe.FullName -ArgumentList $ArgList -Wait -NoNewWindow | Out-Null

# Leer jsons
$auditResults = @()

$fRec = Get-ChildItem -Path $LogOfertado -Filter *Recommendations.json -Recurse | Select-Object -First 1
if (-not $fRec) { $fRec = Get-ChildItem -Path $LogOfertado -Filter *.json -Recurse | Select-Object -First 1 }
if ($fRec) {
    $j = Get-Content $fRec.FullName -Raw | ConvertFrom-Json
    if ($j.HPIA.Recommendations) {
        foreach ($r in $j.HPIA.Recommendations) {
            $auditResults += @{
                name = $r.Name
                category = "Hardware"
                installedVer = "No detectado"
                targetVer = $r.Version
                severity = "Recomendado" 
                status = "DESACTUALIZADO"
            }
        }
    }
}

$fInst = Get-ChildItem -Path $LogOfertado -Filter *Installed.json -Recurse | Select-Object -First 1
if ($fInst) {
    $j2 = Get-Content $fInst.FullName -Raw | ConvertFrom-Json
    if ($j2.HPIA.InstalledPackages) {
        foreach ($p in $j2.HPIA.InstalledPackages) {
            $auditResults += @{
                name = $p.Name
                category = "Hardware"
                installedVer = $p.Version
                targetVer = $p.Version
                severity = "Opcional"
                status = "ACTUALIZADO"
            }
        }
    }
}

# 4. Instalar Criticas
Write-Output "Instalando criticas..."
$ArgInst = "/Operation:Analyze /Selection:Critical /Action:Install /Silent /ReportFolder:`"$LogInstalado`""
Start-Process -FilePath $HPIAExe.FullName -ArgumentList $ArgInst -Wait -NoNewWindow | Out-Null

# 5. Enviar a OEM Driver Auditor
$payload = @{
    deviceId = $deviceId
    hostname = $cs.Name
    oem = "hp"
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
