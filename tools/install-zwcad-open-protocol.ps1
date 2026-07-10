param(
  [string]$ZwcadExe = ""
)

# Instalador conservado por compatibilidad. El nuevo protocolo abre tanto CAD
# como Excel y también registra el antiguo esquema zwcad-open.
& (Join-Path $PSScriptRoot "install-tgm-open-protocol.ps1") -ZwcadExe $ZwcadExe
