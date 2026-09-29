# Empaquetado MSI del Agente Cliente (C#)

Este documento describe el proceso para convertir el código fuente del agente descargado desde el panel web (`Agent.cs`) en un instalador `.msi` corporativo.

El objetivo es compilar la interfaz gráfica de forma nativa en Windows y luego empaquetarla en un MSI para su despliegue silencioso a través de Microsoft Intune, GPO o SCCM.

## Requisitos Previos

1. **Compilador C# (`csc.exe`)**: Incluido nativamente en todas las versiones de Windows con .NET Framework.
2. **WiX Toolset** o **Advanced Installer** (para generar el archivo MSI). En esta guía, utilizaremos **WiX Toolset v3** que es gratuito y open source.
3. El archivo fuente **DriverAgent.cs** descargado desde el dashboard (ya contiene el `{{SERVER_URL}}` dinámicamente inyectado).
4. El script de compilación proporcionado o ejecutado manualmente.

---

## Paso 1: Compilar el Ejecutable (.exe)

Una vez descargado `DriverAgent.cs` desde el botón **"Descargar Agente Cliente"** del panel web de flota, ejecuta el siguiente script en PowerShell (en la misma carpeta donde esté el archivo):

```powershell
# Buscar el compilador de C# nativo de Windows (normalmente en v4.0.30319)
$csc = "$env:windir\Microsoft.NET\Framework\v4.0.30319\csc.exe"

# Opciones de compilación (WinExe para interfaz gráfica sin consola)
$args = "/target:winexe", "/out:AgentGUI.exe", "/optimize", "DriverAgent.cs"

# Ejecutar la compilación
& $csc $args
```

Esto generará el archivo `AgentGUI.exe`.

---

## Paso 2: Crear el Instalador MSI con WiX Toolset

Si tienes instalado WiX Toolset, crea un archivo XML llamado `AgentInstaller.wxs` con la siguiente estructura básica. Este código indica dónde se instalará el agente (típicamente en `Archivos de Programa`) y crea un acceso directo en el menú de inicio y registro para ejecución al inicio de Windows.

### Archivo: `AgentInstaller.wxs`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
    <Product Id="*" Name="OEM Driver Explorer Agent" Language="1033" Version="1.0.0.0" Manufacturer="OEM Corp" UpgradeCode="PUT-A-GUID-HERE">
        <Package InstallerVersion="200" Compressed="yes" InstallScope="perMachine" />
        <MajorUpgrade DowngradeErrorMessage="A newer version is already installed." />
        <MediaTemplate EmbedCab="yes" />

        <Feature Id="ProductFeature" Title="AgentInstaller" Level="1">
            <ComponentGroupRef Id="ProductComponents" />
            <ComponentGroupRef Id="StartupComponents" />
        </Feature>
    </Product>

    <Fragment>
        <Directory Id="TARGETDIR" Name="SourceDir">
            <Directory Id="ProgramFilesFolder">
                <Directory Id="INSTALLFOLDER" Name="OEM Driver Explorer Agent" />
            </Directory>
            <Directory Id="StartupFolder" Name="Startup" />
        </Directory>
    </Fragment>

    <Fragment>
        <ComponentGroup Id="ProductComponents" Directory="INSTALLFOLDER">
            <!-- Referencia al EXE compilado -->
            <Component Id="AgentExecutable" Guid="*">
                <File Id="AgentEXE" Source="AgentGUI.exe" KeyPath="yes" />
            </Component>
        </ComponentGroup>
        
        <ComponentGroup Id="StartupComponents" Directory="StartupFolder">
            <!-- Acceso directo en el inicio de Windows para ejecución en background (flag -Silent si aplica) -->
            <Component Id="AgentStartupShortcut" Guid="*">
                <Shortcut Id="AgentStartup" 
                          Name="OEM Driver Agent" 
                          Description="Inicia el agente de telemetría de drivers"
                          Target="[INSTALLFOLDER]AgentGUI.exe"
                          WorkingDirectory="INSTALLFOLDER" />
                <RegistryValue Root="HKCU" Key="Software\OEMCorp\Agent" Name="installed" Type="integer" Value="1" KeyPath="yes" />
            </Component>
        </ComponentGroup>
    </Fragment>
</Wix>
```

### Compilar el Archivo WXS a MSI

Ejecuta las herramientas de WiX Toolset en consola:

```cmd
candle AgentInstaller.wxs
light -ext WixUIExtension AgentInstaller.wixobj -o OEM-Client-Agent.msi
```

¡Listo! Se habrá generado el archivo `OEM-Client-Agent.msi`.

---

## Paso 3: Despliegue Silencioso (Intune / SCCM)

Este archivo `.msi` puede ser distribuido de forma desatendida mediante MDM usando los parámetros estándar de Windows Installer:

```cmd
msiexec /i "OEM-Client-Agent.msi" /qn /norestart
```

Al instalarse, el Agente cargará el valor inyectado de la URL del servidor y comenzará a enviar la telemetría del equipo directamente al Dashboard web.
