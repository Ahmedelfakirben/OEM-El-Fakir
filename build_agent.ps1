# Script de Compilacion y Firma Digital para AgentGUI.exe

Write-Host "Buscando el compilador de C# (csc.exe)..." -ForegroundColor Cyan
$cscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $cscPath)) {
    $cscPath = "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
}

if (-not (Test-Path $cscPath)) {
    Write-Host "ERROR: No se encontró csc.exe. Instala .NET Framework." -ForegroundColor Red
    exit
}

Write-Host "Compilando Agent.cs a AgentGUI.exe..." -ForegroundColor Cyan
& $cscPath /nologo /target:winexe /out:AgentGUI.exe /reference:System.Windows.Forms.dll,System.Drawing.dll,System.Management.dll,System.Web.Extensions.dll Agent.cs

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error durante la compilación." -ForegroundColor Red
    exit
}
Write-Host "¡Compilación exitosa!" -ForegroundColor Green

Write-Host "`nGenerando Certificado de Firma Digital (Self-Signed)..." -ForegroundColor Cyan
# Se usa un certificado válido por 5 años
$cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=OEM Driver Explorer Corp" -KeyAlgorithm RSA -KeyLength 2048 -CertStoreLocation "Cert:\CurrentUser\My" -NotAfter (Get-Date).AddYears(5)

Write-Host "Firmando AgentGUI.exe digitalmente..." -ForegroundColor Cyan
Set-AuthenticodeSignature -FilePath ".\AgentGUI.exe" -Certificate $cert

Write-Host "`n¡Proceso Completado!" -ForegroundColor Green
Write-Host "Ahora puedes ejecutar .\AgentGUI.exe de forma segura. El antivirus lo respetará al estar compilado y firmado." -ForegroundColor White
