# ZhiWeiJZ Docker Build and Push Script
param(
    [switch]$SkipVersionBump,
    [string]$CustomVersion = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

$DOCKER_USERNAME = "nanpo"
$IMAGE_PREFIX = "zhiweijz"

$IMAGES = @(
    @{ Name = "backend"; Path = "server/Dockerfile" },
    @{ Name = "frontend"; Path = "apps/web/Dockerfile" },
    @{ Name = "nginx"; Path = "docker/Dockerfile.nginx" }
)

function Write-Step { param($Msg) Write-Host "`n=== $Msg ===" -ForegroundColor Cyan }
function Write-Success { param($Msg) Write-Host "[OK] $Msg" -ForegroundColor Green }
function Write-Info { param($Msg) Write-Host "[INFO] $Msg" -ForegroundColor Yellow }
function Write-Err { param($Msg) Write-Host "[ERROR] $Msg" -ForegroundColor Red }

Set-Location $ProjectRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  ZhiWeiJZ Docker Build & Push Script" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

Write-Step "Checking Docker"
try {
    $dockerVersion = docker --version 2>$null
    Write-Success "Docker ready: $dockerVersion"
} catch {
    Write-Err "Docker is not running"
    exit 1
}

Write-Step "Getting Version"
$VersionFile = Join-Path $ProjectRoot "docker\VERSION"

if ($CustomVersion) {
    $NEW_VERSION = $CustomVersion
    Write-Info "Using custom version: $NEW_VERSION"
} elseif (Test-Path $VersionFile) {
    $CURRENT_VERSION = Get-Content $VersionFile -Raw | ForEach-Object { $_.Trim() }
    Write-Info "Current version: $CURRENT_VERSION"
    
    if ($SkipVersionBump) {
        $NEW_VERSION = $CURRENT_VERSION
        Write-Info "Skipping version bump"
    } else {
        $parts = $CURRENT_VERSION.Split('.')
        $patch = [int]$parts[2] + 1
        $NEW_VERSION = "$($parts[0]).$($parts[1]).$patch"
        Write-Info "New version: $NEW_VERSION"
    }
} else {
    $NEW_VERSION = "1.9.2"
    Write-Info "No VERSION file found, using: $NEW_VERSION"
}

$NEW_VERSION | Set-Content $VersionFile -NoNewline
Write-Success "Version saved: $NEW_VERSION"

Write-Step "Building and Pushing Images"
Write-Host ""

$FailedImages = @()

foreach ($img in $IMAGES) {
    $ImageName = $img.Name
    $DockerfilePath = $img.Path
    $FullImageName = "${DOCKER_USERNAME}/${IMAGE_PREFIX}-${ImageName}"
    
    Write-Host "----------------------------------"
    
    Write-Step "Building $FullImageName`:$NEW_VERSION"
    Write-Info "Dockerfile: $DockerfilePath"
    
    $process = Start-Process -FilePath "docker" -ArgumentList "build","-f",$DockerfilePath,"-t","${FullImageName}:$NEW_VERSION","-t","${FullImageName}:latest","." -Wait -PassThru -NoNewWindow
    $process.WaitForExit()
    
    if ($process.ExitCode -ne 0) {
        Write-Err "Build failed: $ImageName"
        $FailedImages += $ImageName
        continue
    }
    
    Write-Success "Build completed: $ImageName"
    
    Write-Step "Pushing $FullImageName`:$NEW_VERSION"
    
    $push1 = Start-Process -FilePath "docker" -ArgumentList "push","${FullImageName}:$NEW_VERSION" -Wait -PassThru -NoNewWindow
    if ($push1.ExitCode -ne 0) {
        Write-Err "Push version tag failed: $ImageName"
        $FailedImages += $ImageName
        continue
    }
    Write-Success "Version tag pushed"
    
    $push2 = Start-Process -FilePath "docker" -ArgumentList "push","${FullImageName}:latest" -Wait -PassThru -NoNewWindow
    if ($push2.ExitCode -ne 0) {
        Write-Err "Push latest tag failed: $ImageName"
        $FailedImages += $ImageName
        continue
    }
    Write-Success "Latest tag pushed"
    
    Write-Host ""
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta

if ($FailedImages.Count -eq 0) {
    Write-Host ""
    Write-Host "Build and Push Completed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Version: $NEW_VERSION" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Images:"
    foreach ($img in $IMAGES) {
        $FullImageName = "$DOCKER_USERNAME/${IMAGE_PREFIX}-$($img.Name)"
        Write-Host "  - ${FullImageName}:${NEW_VERSION}" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "Deployment:"
    Write-Host "  BACKEND_IMAGE_VERSION=$NEW_VERSION" -ForegroundColor Cyan
    Write-Host "  FRONTEND_IMAGE_VERSION=$NEW_VERSION" -ForegroundColor Cyan
    Write-Host "  NGINX_IMAGE_VERSION=$NEW_VERSION" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Magenta
    exit 0
} else {
    Write-Host ""
    Write-Host "Some images failed:" -ForegroundColor Yellow
    foreach ($failed in $FailedImages) {
        Write-Host "  - $failed" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Magenta
    exit 1
}
