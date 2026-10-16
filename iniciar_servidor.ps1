# Ativa o ambiente virtual, se existir
$venv = Join-Path $PSScriptRoot '.venv\Scripts\Activate.ps1'
if (Test-Path $venv) { & $venv }

# Escolhe um Python real: ignora o atalho da Microsoft Store (WindowsApps)
$python = Get-Command python, python3 -All -ErrorAction SilentlyContinue |
    Where-Object { $_.Source -notlike '*\WindowsApps\*' } |
    Select-Object -First 1
if (-not $python) {
    Write-Host 'Python não encontrado. Instale o Python ou crie o .venv.' -ForegroundColor Red
    exit 1
}

# Serve a pasta do projeto, independente de onde o script foi chamado
Set-Location $PSScriptRoot
& $python.Source -m http.server 8000
