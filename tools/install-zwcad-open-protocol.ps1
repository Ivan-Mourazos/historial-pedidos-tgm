param(
  [string]$ZwcadExe = ""
)

$ErrorActionPreference = "Stop"

$installDir = Join-Path $env:LOCALAPPDATA "TGM-Pedidos"
$handlerPath = Join-Path $installDir "open-zwcad.ps1"

New-Item -ItemType Directory -Path $installDir -Force | Out-Null

$escapedZwcadExe = $ZwcadExe -replace "'", "''"

$handler = @"
param(
  [string]`$Url
)

`$ErrorActionPreference = "Stop"

function Get-QueryValue {
  param(
    [string]`$UrlValue,
    [string]`$Name
  )

  `$match = [regex]::Match(`$UrlValue, "[?&]" + [regex]::Escape(`$Name) + "=([^&]+)")
  if (-not `$match.Success) {
    return `$null
  }

  return [System.Uri]::UnescapeDataString(`$match.Groups[1].Value)
}

`$filePath = Get-QueryValue -UrlValue `$Url -Name "path"
if ([string]::IsNullOrWhiteSpace(`$filePath)) {
  throw "No se recibio la ruta del DWG."
}

`$zwcadExe = '$escapedZwcadExe'
if (-not [string]::IsNullOrWhiteSpace(`$zwcadExe) -and (Test-Path -LiteralPath `$zwcadExe)) {
  Start-Process -FilePath `$zwcadExe -ArgumentList @(`$filePath)
  exit
}

Start-Process -FilePath `$filePath
"@

Set-Content -LiteralPath $handlerPath -Value $handler -Encoding UTF8

$protocolKey = "HKCU:\Software\Classes\zwcad-open"
New-Item -Path $protocolKey -Force | Out-Null
Set-Item -Path $protocolKey -Value "URL:ZWCAD Open Protocol"
New-ItemProperty -Path $protocolKey -Name "URL Protocol" -Value "" -PropertyType String -Force | Out-Null

New-Item -Path "$protocolKey\shell\open\command" -Force | Out-Null
$command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$handlerPath`" `"%1`""
Set-Item -Path "$protocolKey\shell\open\command" -Value $command

Write-Host "Protocolo zwcad-open instalado para el usuario actual."
Write-Host "Prueba: zwcad-open://open?path=%5C%5Cstinkor%5Coftecnica%5C2026%5CAR2603022.dwg"
