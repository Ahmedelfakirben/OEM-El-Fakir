[Setup]
AppName=Driver Explorer Client
AppVersion=1.0.0
DefaultDirName={pf}\Driver Explorer Client
DefaultGroupName=Driver Explorer Client
OutputDir=.\Output
OutputBaseFilename=DriverExplorerClient_Setup
SetupIconFile=refresh_14433.ico
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin

[Files]
; Archivos para la versión script (PowerShell)
Source: "..\AgentGUI.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\refresh_14433.ico"; DestDir: "{app}"; Flags: ignoreversion

; Si compilan Agent.cs a Agent.exe, pueden usar las siguientes lineas en lugar de las anteriores:
; Source: "..\Agent.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; Acceso directo para el Menu Inicio (usando el script de PS1)
Name: "{group}\Driver Explorer Client"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\AgentGUI.ps1"""
Name: "{group}\Uninstall Driver Explorer Client"; Filename: "{uninstallexe}"

; Acceso directo si usan Agent.exe
; Name: "{group}\Driver Explorer Client"; Filename: "{app}\Agent.exe"

[Registry]
; Clave de registro para arranque automático al iniciar Windows, ejecutando en modo -Silent
; Para el script de PS1:
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "DriverExplorerClient"; ValueData: "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\AgentGUI.ps1"" -Silent"; Flags: uninsdeletevalue

; Si usan Agent.exe:
; Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "DriverExplorerClient"; ValueData: """{app}\Agent.exe"" -Silent"; Flags: uninsdeletevalue

[Run]
; Ejecutar inmediatamente al terminar la instalación en modo silencioso
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\AgentGUI.ps1"" -Silent"; Description: "Lanzar Driver Explorer Client en segundo plano"; Flags: nowait postinstall runhidden

; Si usan Agent.exe:
; Filename: "{app}\Agent.exe"; Parameters: "-Silent"; Description: "Lanzar Driver Explorer Client en segundo plano"; Flags: nowait postinstall runhidden
