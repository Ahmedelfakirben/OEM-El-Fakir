# ==============================================================================
# Script de Desinstalación y Limpieza del Agente OEM Client
# ==============================================================================

$ErrorActionPreference = "SilentlyContinue"

# Eliminar Tarea Programada de Windows
Unregister-ScheduledTask -TaskName "OEMDriverAgent" -Confirm:$false -ErrorAction SilentlyContinue

# Detener procesos residuales si los hubiera
Get-Process -Name "powershell" -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.CommandLine -like "*OEMAgent.ps1*" } | Stop-Process -Force -ErrorAction SilentlyContinue

# Opcional: Eliminar archivos temporales de cache
$cacheDir = "C:\ProgramData\OEMDriverAgent\Cache"
if (Test-Path $cacheDir) {
    Remove-Item -Path $cacheDir -Recurse -Force -ErrorAction SilentlyContinue
}
