$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (Test-Path -LiteralPath "$PSScriptRoot\tools\node.exe") {
    $env:PATH = "$PSScriptRoot\tools;$env:PATH"
    & "$PSScriptRoot\tools\node.exe" "$PSScriptRoot\node_modules\vite\bin\vite.js" --host 127.0.0.1
} else {
    npm run dev
}
