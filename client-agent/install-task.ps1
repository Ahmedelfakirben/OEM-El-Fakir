# ==============================================================================
# Script de Registro y Configuración de Tarea Programada en Windows
# Ejecutado automáticamente por el instalador MSI / Intune
# ==============================================================================

[CmdletBinding()]
param (
    [string]$ServerUrl = ""
)

$ErrorActionPreference = "SilentlyContinue"

$installDir = "C:\Program Files\OEMDriverAgent"
$dataDir = "C:\ProgramData\OEMDriverAgent"

if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
}

# 1. Actualizar URL del servidor si se proporcionó como propiedad pública del MSI
if ($ServerUrl) {
    $cfgPath = Join-Path $installDir "config.json"
    $config = @{
        ServerUrl = $ServerUrl.TrimEnd('/')
        IntervalMinutes = 1440
        AutoUpdate = $true
        LogPath = "$dataDir\agent.log"
    }
    try {
        $config | ConvertTo-Json | Out-File -FilePath $cfgPath -Encoding UTF8 -Force
    } catch {}
}

# 2. Configurar Tarea Programada de Windows (SYSTEM)
$taskName = "OEMDriverAgent"
$scriptPath = Join-Path $installDir "OEMAgent.ps1"

# Eliminar tarea previa si existiera
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# Definir Acción
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""

# Definir Disparadores: Al inicio del sistema y diariamente
$triggerStartup = New-ScheduledTaskTrigger -AtStartup
$triggerDaily = New-ScheduledTaskTrigger -Daily -At "03:00"

# Opciones de Ejecución
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)

# Registrar tarea con los máximos privilegios como SYSTEM
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($triggerStartup, $triggerDaily) -Settings $settings -User "NT AUTHORITY\SYSTEM" -RunLevel Highest -Force | Out-Null

# 3. Lanzar una primera ejecución de telemetría en segundo plano
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`"" -WindowStyle Hidden
