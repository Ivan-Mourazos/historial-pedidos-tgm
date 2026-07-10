param(
  [string]$ZwcadExe = "",
  [string]$ExcelExe = "",
  [string[]]$AllowedRoots = @("\\stinkor\oftecnica"),
  [string]$InstallDir = "",
  [switch]$SkipRegistration
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($InstallDir)) {
  $InstallDir = Join-Path $env:LOCALAPPDATA "TGM-Pedidos"
}
$handlerPath = Join-Path $installDir "open-pedido-file.ps1"
$logPath = Join-Path $installDir "open.log"

New-Item -ItemType Directory -Path $installDir -Force | Out-Null

function Quote-PowerShellLiteral([string]$Value) {
  return "'" + $Value.Replace("'", "''") + "'"
}

$rootsLiteral = ($AllowedRoots | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object {
  Quote-PowerShellLiteral $_.Trim()
}) -join ", "
$zwcadLiteral = Quote-PowerShellLiteral $ZwcadExe
$excelLiteral = Quote-PowerShellLiteral $ExcelExe
$logLiteral = Quote-PowerShellLiteral $logPath

$handler = @"
param([string]`$Url)

`$ErrorActionPreference = "Stop"
`$allowedRoots = @($rootsLiteral)
`$zwcadExe = $zwcadLiteral
`$excelExe = $excelLiteral
`$logPath = $logLiteral

function Get-QueryValue {
  param([string]`$UrlValue, [string]`$Name)
  `$match = [regex]::Match(`$UrlValue, "[?&]" + [regex]::Escape(`$Name) + "=([^&]+)")
  if (-not `$match.Success) { return `$null }
  return [System.Uri]::UnescapeDataString(`$match.Groups[1].Value)
}

function Assert-AllowedPath {
  param([string]`$FilePath)
  `$fullPath = [System.IO.Path]::GetFullPath(`$FilePath).TrimEnd('\')
  foreach (`$root in `$allowedRoots) {
    `$fullRoot = [System.IO.Path]::GetFullPath(`$root).TrimEnd('\')
    if (`$fullPath.Equals(`$fullRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
        `$fullPath.StartsWith(`$fullRoot + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
      return `$fullPath
    }
  }
  throw "La ruta no pertenece a una carpeta autorizada."
}

function Start-WithOptionalExe {
  param([string]`$FilePath, [string]`$ExePath)
  if (-not [string]::IsNullOrWhiteSpace(`$ExePath)) {
    if (-not (Test-Path -LiteralPath `$ExePath -PathType Leaf)) {
      throw "No se encuentra el ejecutable configurado: `$ExePath"
    }
    Start-Process -FilePath `$ExePath -ArgumentList ('"{0}"' -f `$FilePath)
    return
  }
  Start-Process -FilePath `$FilePath
}

try {
  `$kind = Get-QueryValue -UrlValue `$Url -Name "kind"
  if ([string]::IsNullOrWhiteSpace(`$kind)) { `$kind = "cad" }
  `$kind = `$kind.ToLowerInvariant()

  `$filePath = Get-QueryValue -UrlValue `$Url -Name "path"
  if ([string]::IsNullOrWhiteSpace(`$filePath)) { throw "No se recibió la ruta del archivo." }
  `$filePath = Assert-AllowedPath `$filePath
  if (-not (Test-Path -LiteralPath `$filePath -PathType Leaf)) { throw "No se encuentra el archivo: `$filePath" }

  `$extension = [System.IO.Path]::GetExtension(`$filePath).ToLowerInvariant()
  if (`$kind -eq "cad") {
    if (`$extension -ne ".dwg") { throw "CAD solo permite archivos .dwg." }
    Start-WithOptionalExe -FilePath `$filePath -ExePath `$zwcadExe
  } elseif (`$kind -eq "excel") {
    if (`$extension -notin @(".xlsx", ".xlsm", ".xls", ".xlsb")) {
      throw "Excel solo permite .xlsx, .xlsm, .xls o .xlsb."
    }
    Start-WithOptionalExe -FilePath `$filePath -ExePath `$excelExe
  } else {
    throw "Tipo de archivo no permitido: `$kind"
  }

  Add-Content -LiteralPath `$logPath -Encoding UTF8 -Value "`$(Get-Date -Format o) OK `$kind `$filePath"
} catch {
  Add-Content -LiteralPath `$logPath -Encoding UTF8 -Value "`$(Get-Date -Format o) ERROR `$(`$_.Exception.Message) URL=`$Url"
  try {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(`$_.Exception.Message, "TGM Pedidos", "OK", "Error") | Out-Null
  } catch {}
  exit 1
}
"@

Set-Content -LiteralPath $handlerPath -Value $handler -Encoding UTF8

function Register-Protocol([string]$Name, [string]$Description) {
  $protocolKey = "HKCU:\Software\Classes\$Name"
  New-Item -Path $protocolKey -Force | Out-Null
  Set-Item -Path $protocolKey -Value $Description
  New-ItemProperty -Path $protocolKey -Name "URL Protocol" -Value "" -PropertyType String -Force | Out-Null
  New-Item -Path "$protocolKey\shell\open\command" -Force | Out-Null
  $command = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$handlerPath`" `"%1`""
  Set-Item -Path "$protocolKey\shell\open\command" -Value $command
}

if (-not $SkipRegistration) {
  Register-Protocol -Name "tgm-pedidos" -Description "URL:TGM Pedidos File Protocol"
  # Compatibilidad con enlaces CAD generados por instalaciones anteriores.
  Register-Protocol -Name "zwcad-open" -Description "URL:ZWCAD Open Protocol"
}

if ($SkipRegistration) {
  Write-Host "Handler generado sin modificar el registro (modo de prueba)."
} else {
  Write-Host "Protocolo tgm-pedidos instalado para el usuario actual."
}
Write-Host "Carpetas permitidas: $($AllowedRoots -join '; ')"
Write-Host "Handler: $handlerPath"
Write-Host "Log: $logPath"
Write-Host "Prueba CAD: tgm-pedidos://open?kind=cad&path=%5C%5Cstinkor%5Coftecnica%5C2026%5CAR2603022.dwg"
Write-Host "Prueba Excel: tgm-pedidos://open?kind=excel&path=%5C%5Cstinkor%5Coftecnica%5C2026%5CAR2603022.xlsm"
