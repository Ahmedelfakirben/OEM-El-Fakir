param([switch]$Silent)

<#
.SYNOPSIS
  Agente Gráfico de Windows (GUI) - Driver Explorer
  Autor: Arquitecto de Software
  Versión: 1.0.0
#>

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$Global:ServerURL = "http://localhost:3000"
$Global:ApiKey = "m2m-super-secret-key-for-agents"
$Global:LogPath = "C:\ProgramData\DriverExplorer"
$Global:LogFile = "$Global:LogPath\client.log"
$Global:MachineId = (Get-CimInstance Win32_ComputerSystemProduct).UUID
$Global:AppIcon = Join-Path $PSScriptRoot "refresh_14433.ico"
# Ensure log directory exists
if (-not (Test-Path $Global:LogPath)) {
    New-Item -ItemType Directory -Force -Path $Global:LogPath | Out-Null
}

# -----------------------------------------------------------------------------
# Funciones de TelemetrÃ­a (Write-Log)
# -----------------------------------------------------------------------------
function Write-Log {
    param (
        [string]$Message,
        [string]$Level = "INFO"
    )
    $Timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $LogLine = "[$Timestamp] [$Level] $Message"
    
    # Escribir localmente
    Add-Content -Path $Global:LogFile -Value $LogLine

    # Enviar al servidor (Fire and Forget)
    $Payload = @{
        machineId = $Global:MachineId
        timestamp = $Timestamp
        level = $Level
        message = $Message
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "$Global:ServerURL/api/client/logs" `
                          -Method Post `
                          -Headers @{ "x-device-api-key" = $Global:ApiKey; "Content-Type" = "application/json" } `
                          -Body $Payload `
                          -ErrorAction Stop | Out-Null
    } catch {
        # Si falla el envÃ­o, simplemente se ignora para no colgar la UI
        Add-Content -Path $Global:LogFile -Value "[$Timestamp] [ERROR] FallÃ³ envÃ­o de telemetrÃ­a al servidor: $_"
    }
}

# -----------------------------------------------------------------------------
# Funciones de Limpieza e Instalación Silenciosa
# -----------------------------------------------------------------------------
function Kill-GhostInstallers {
    $ghostNames = @("Setup", "SynReflash", "Reflash", "fwupdatetool", "Win32 FW Update Tool", "For Lenovo Updates Catalog", "dpinst", "dpinst64", "drvsetup", "pnputil", "fwnva", "fwsdw", "fwnv", "fwsd", "FUDF", "fudf")
    foreach ($gName in $ghostNames) {
        Get-Process -Name $gName -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    }
}

# -----------------------------------------------------------------------------
# Funciones de Comunicación API
# -----------------------------------------------------------------------------
function Get-ApprovedUpdates {
    Write-Log -Message "Solicitando actualizaciones al servidor..." -Level "INFO"
    try {
        $WebRequest = Invoke-WebRequest -Uri "$Global:ServerURL/api/client/updates/$Global:MachineId" `
                                      -Method Get `
                                      -Headers @{ "x-device-api-key" = $Global:ApiKey } `
                                      -ErrorAction Stop
        
        if ($WebRequest.Content -is [byte[]]) {
            $JsonString = [System.Text.Encoding]::UTF8.GetString($WebRequest.Content)
        } else {
            $JsonString = [string]$WebRequest.Content
        }
        $Response = $JsonString | ConvertFrom-Json
        
        Write-Log -Message "Respuesta recibida. Habilitado: $($Response.policy.enabled)" -Level "INFO"
        return $Response
    } catch {
        Write-Log -Message "Error al consultar API: $_" -Level "ERROR"
        return $null
    }
}

# -----------------------------------------------------------------------------
# GUI: Windows Forms
# -----------------------------------------------------------------------------
$Form = New-Object System.Windows.Forms.Form
$Form.Text = "Driver Explorer Client"
$Form.Size = New-Object System.Drawing.Size(700, 480)
$Form.StartPosition = "CenterScreen"
$Form.BackColor = [System.Drawing.Color]::White

if (Test-Path $Global:AppIcon) {
    $Form.Icon = New-Object System.Drawing.Icon($Global:AppIcon)
}

$LabelTitle = New-Object System.Windows.Forms.Label
$LabelTitle.Text = "Controladores Aprobados por Politicas Corporativas"
$LabelTitle.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$LabelTitle.Location = New-Object System.Drawing.Point(15, 15)
$LabelTitle.AutoSize = $true
$LabelTitle.ForeColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$Form.Controls.Add($LabelTitle)

$lblStatus = New-Object System.Windows.Forms.Label
$lblStatus.Text = "Estado: Verificando..."
$lblStatus.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$lblStatus.Location = New-Object System.Drawing.Point(15, 45)
$lblStatus.AutoSize = $true
$lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$Form.Controls.Add($lblStatus)

$GroupBox = New-Object System.Windows.Forms.GroupBox
$GroupBox.Text = "Información del Sistema"
$GroupBox.Location = New-Object System.Drawing.Point(15, 75)
$GroupBox.Size = New-Object System.Drawing.Size(650, 60)
$GroupBox.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$GroupBox.ForeColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$Form.Controls.Add($GroupBox)

$lblEquipo = New-Object System.Windows.Forms.Label
$lblEquipo.Text = "Equipo: " + $env:COMPUTERNAME
$lblEquipo.Location = New-Object System.Drawing.Point(15, 25)
$lblEquipo.AutoSize = $true
$lblEquipo.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$lblEquipo.ForeColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$GroupBox.Controls.Add($lblEquipo)

$lblModelo = New-Object System.Windows.Forms.Label
try { $modelo = (Get-CimInstance Win32_ComputerSystem).Model } catch { $modelo = "Desconocido" }
$lblModelo.Text = "Modelo: " + $modelo
$lblModelo.Location = New-Object System.Drawing.Point(220, 25)
$lblModelo.AutoSize = $true
$lblModelo.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$lblModelo.ForeColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$GroupBox.Controls.Add($lblModelo)

$lblSO = New-Object System.Windows.Forms.Label
try { $so = (Get-CimInstance Win32_OperatingSystem).Caption } catch { $so = "Windows" }
$lblSO.Text = "SO: " + $so
$lblSO.Location = New-Object System.Drawing.Point(420, 25)
$lblSO.AutoSize = $true
$lblSO.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$lblSO.ForeColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$GroupBox.Controls.Add($lblSO)

$DataGrid = New-Object System.Windows.Forms.DataGridView
$DataGrid.Location = New-Object System.Drawing.Point(15, 145)
$DataGrid.Size = New-Object System.Drawing.Size(650, 180)
$DataGrid.AllowUserToAddRows = $false
$DataGrid.AllowUserToDeleteRows = $false
$DataGrid.ReadOnly = $true
$DataGrid.SelectionMode = "FullRowSelect"
$DataGrid.AutoSizeColumnsMode = "Fill"
$DataGrid.BackgroundColor = [System.Drawing.Color]::WhiteSmoke
$Form.Controls.Add($DataGrid)

$ProgressBar = New-Object System.Windows.Forms.ProgressBar
$ProgressBar.Location = New-Object System.Drawing.Point(15, 390)
$ProgressBar.Size = New-Object System.Drawing.Size(500, 25)
$ProgressBar.Style = "Continuous"
$ProgressBar.Visible = $false
$Form.Controls.Add($ProgressBar)

$LabelProgress = New-Object System.Windows.Forms.Label
$LabelProgress.Text = "0%"
$LabelProgress.Location = New-Object System.Drawing.Point(525, 395)
$LabelProgress.AutoSize = $true
$LabelProgress.Visible = $false
$Form.Controls.Add($LabelProgress)

$BtnInstall = New-Object System.Windows.Forms.Button
$BtnInstall.Text = "Descargar e Instalar"
$BtnInstall.Location = New-Object System.Drawing.Point(515, 340)
$BtnInstall.Size = New-Object System.Drawing.Size(150, 35)
$BtnInstall.BackColor = [System.Drawing.Color]::FromArgb(54, 95, 136)
$BtnInstall.ForeColor = [System.Drawing.Color]::White
$BtnInstall.FlatStyle = "Flat"
$BtnInstall.FlatAppearance.BorderSize = 0
$BtnInstall.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$BtnInstall.Enabled = $false
$Form.Controls.Add($BtnInstall)

$BtnCheck = New-Object System.Windows.Forms.Button
$BtnCheck.Text = "Revisar"
$BtnCheck.Location = New-Object System.Drawing.Point(350, 340)
$BtnCheck.Size = New-Object System.Drawing.Size(150, 35)
$BtnCheck.BackColor = [System.Drawing.Color]::FromArgb(54, 95, 136)
$BtnCheck.ForeColor = [System.Drawing.Color]::White
$BtnCheck.FlatStyle = "Flat"
$BtnCheck.FlatAppearance.BorderSize = 0
$BtnCheck.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$Form.Controls.Add($BtnCheck)

# LÃ³gica de carga
function Load-UpdatesData {
    $BtnCheck.Enabled = $false
    $BtnInstall.Enabled = $false
    $lblStatus.Text = "Buscando actualizaciones..."
    $DataGrid.DataSource = $null
    $Form.Refresh()

    Write-Log -Message "Agente GUI comprobando actualizaciones. Machine ID: $Global:MachineId"
    $Data = Get-ApprovedUpdates
    
    if ($null -eq $Data) {
        $lblStatus.Text = "Error al conectar con el servidor."
        $BtnCheck.Enabled = $true
        return
    }

    if ($Data.policy.enabled) {
        if ($Data.policy.criticalOnly) {
            $lblStatus.Text = "Politicas Habilitadas | Modo: Solo Criticos"
        } else {
            $lblStatus.Text = "Politicas Habilitadas | Modo: Todos los Drivers"
        }
    } else {
        $lblStatus.Text = "Politicas Pausadas (Modo Solo Auditoria). No hay actualizaciones disponibles."
    }

    $global:UpdatesList = $Data.updates
    if ($global:UpdatesList -and $global:UpdatesList.Count -gt 0) {
        $BtnInstall.Enabled = $true
        # Convertir a DataTable para el GridView
        $DataTable = New-Object System.Data.DataTable
        $DataTable.Columns.Add("Controlador") | Out-Null
        $DataTable.Columns.Add("Categoria") | Out-Null
        $DataTable.Columns.Add("Instalado") | Out-Null
        $DataTable.Columns.Add("Aprobado (Ofertado)") | Out-Null
        $DataTable.Columns.Add("Criticidad") | Out-Null

        foreach ($update in $global:UpdatesList) {
            $Row = $DataTable.NewRow()
            $Row["Controlador"] = $update.driver_name
            $Row["Categoria"] = $update.category
            $Row["Instalado"] = $update.installed_version
            $Row["Aprobado (Ofertado)"] = $update.latest_version
            $Row["Criticidad"] = $update.severity
            $DataTable.Rows.Add($Row)
        }
        $DataGrid.DataSource = $DataTable
    } else {
        if ($Data.policy.enabled) {
            $lblStatus.Text += " | Su equipo esta al dia."
        }
    }
    $BtnCheck.Enabled = $true
}

$BtnCheck.Add_Click({ Load-UpdatesData })

$Form.Add_Load({
    if (-not $Silent) {
        Load-UpdatesData
    }
})

# LÃ³gica de instalaciÃ³n (Simulada con barra de progreso)
$BtnInstall.Add_Click({
    $BtnInstall.Enabled = $false
    $BtnCheck.Enabled = $false
    
    $ProgressBar.Visible = $true
    $LabelProgress.Visible = $true
    
    Write-Log -Message "Iniciando descarga e instalación REAL de $($global:UpdatesList.Count) paquete(s)..." -Level "INFO"

    foreach ($update in $global:UpdatesList) {
        Kill-GhostInstallers
        $url = $update.download_url
        $fileName = Split-Path $url -Leaf
        if ([string]::IsNullOrWhiteSpace($url)) { continue }
        
        Write-Log -Message "Descargando $fileName desde Lenovo/HP..." -Level "INFO"
        
        $tempPath = Join-Path $env:TEMP $fileName
        $WebClient = New-Object System.Net.WebClient
        
        $global:DownloadComplete = $false
        
        Register-ObjectEvent -InputObject $WebClient -EventName DownloadProgressChanged -Action {
            $percent = $Event.SourceEventArgs.ProgressPercentage
            $ProgressBar = $Event.MessageData[0]
            $LabelProgress = $Event.MessageData[1]
            $ProgressBar.Value = $percent
            $LabelProgress.Text = "$percent%"
            [System.Windows.Forms.Application]::DoEvents()
        } -MessageData @($ProgressBar, $LabelProgress) | Out-Null
        
        Register-ObjectEvent -InputObject $WebClient -EventName DownloadFileCompleted -Action {
            $global:DownloadComplete = $true
        } | Out-Null
        
        $WebClient.DownloadFileAsync([System.Uri]::new($url), $tempPath)
        
        while (-not $global:DownloadComplete) {
            [System.Windows.Forms.Application]::DoEvents()
            Start-Sleep -Milliseconds 50
        }
        
        Write-Log -Message "Descarga completada: $fileName. Instalando silenciosamente..." -Level "SUCCESS"
        
        try {
            if ($fileName.EndsWith(".exe")) {
                Kill-GhostInstallers
                $pinfo = New-Object System.Diagnostics.ProcessStartInfo
                $pinfo.FileName = $tempPath
                $pinfo.Arguments = "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /NOCANCEL /SP- /S /q /qn"
                $pinfo.UseShellExecute = $false
                $pinfo.CreateNoWindow = $true

                $proc = [System.Diagnostics.Process]::Start($pinfo)
                if ($null -ne $proc) {
                    $sw = [System.Diagnostics.Stopwatch]::StartNew()
                    $hasExited = $false
                    while (-not $hasExited -and $sw.Elapsed.TotalSeconds -lt 25) {
                        [System.Windows.Forms.Application]::DoEvents()
                        Start-Sleep -Milliseconds 500
                        $hasExited = $proc.HasExited
                    }
                    if (-not $hasExited) {
                        Write-Log -Message "Timeout (20s): El instalador $fileName se quedó colgado en segundo plano. Forzando cierre..." -Level "WARN"
                        try { $proc.Kill() } catch {}
                        Kill-GhostInstallers
                    } else {
                        Write-Log -Message "Instalación de $fileName finalizada con código $($proc.ExitCode)" -Level "SUCCESS"
                    }
                } else {
                    Write-Log -Message "Instalación de $fileName finalizada con código 0" -Level "SUCCESS"
                }
                Kill-GhostInstallers
            } elseif ($fileName.EndsWith(".zip")) {
                Write-Log -Message "Extrayendo archivo ZIP $fileName..." -Level "INFO"
                Expand-Archive -Path $tempPath -DestinationPath (Join-Path $env:TEMP "OEM_Updates") -Force
                Write-Log -Message "Instalación de $fileName finalizada con código 0" -Level "SUCCESS"
            }
        } catch {
            Write-Log -Message "Error al instalar o extraer $($fileName) - $_" -Level "ERROR"
        }
    }
    
    [System.Windows.Forms.MessageBox]::Show("Instalación de controladores finalizada.", "Actualización Completada", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
    
    $ProgressBar.Visible = $false
    $LabelProgress.Visible = $false
    
    # Refrescar UI
    Load-UpdatesData
})

$Form.ShowDialog() | Out-Null




