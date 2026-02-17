# DesignLog 扩展一键打包：先 build，再打成 zip
# 用法：在项目根目录双击运行，或在 PowerShell 中 .\pack-extension.ps1

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$zipName = "DesignLog-extension.zip"
$distPath = "dist"

Write-Host "Building extension (npm run build:extension)..." -ForegroundColor Cyan
& npm run build:extension
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $distPath)) {
    Write-Host "dist/ not found after build." -ForegroundColor Red
    exit 1
}

# 删除旧 zip（如有）
if (Test-Path $zipName) { Remove-Item $zipName -Force }

Write-Host "Creating $zipName ..." -ForegroundColor Cyan
Compress-Archive -Path $distPath -DestinationPath $zipName -Force

$fullPath = (Resolve-Path $zipName).Path
Write-Host "Done: $fullPath" -ForegroundColor Green
Write-Host "Recipient: unzip and load the 'dist' folder in chrome://extensions (Load unpacked)." -ForegroundColor Gray
