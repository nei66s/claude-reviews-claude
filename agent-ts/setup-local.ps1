#!/usr/bin/env pwsh
# SETUP-LOCAL.ps1 - Configure Chocks para uso local

Write-Host "🚀 Configurando Chocks para uso local..." -ForegroundColor Cyan

# Verificar se Docker está instalado
$dockerCheck = docker --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker não encontrado. Instale em https://www.docker.com/products/docker-desktop" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Docker encontrado: $dockerCheck" -ForegroundColor Green

# Start PostgreSQL container
Write-Host "`n📦 Iniciando PostgreSQL em Docker..." -ForegroundColor Cyan
docker run -d `
    --name chocks-postgres `
    -e POSTGRES_PASSWORD=mysecret `
    -e POSTGRES_DB=chocks `
    -p 5432:5432 `
    postgres:15

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ PostgreSQL iniciado em localhost:5432" -ForegroundColor Green
} else {
    Write-Host "⚠️ Container talvez já esteja rodando. Continuando..." -ForegroundColor Yellow
}

# Atualizar .env.local
Write-Host "`n📝 Atualizando .env.local..." -ForegroundColor Cyan

$envLocalPath = ".env.local"
if (Test-Path $envLocalPath) {
    $envContent = Get-Content $envLocalPath -Raw
    
    # Descomente a linha do DATABASE_URL
    $envContent = $envContent -replace `
        "# DATABASE_URL=postgresql://postgres:mysecret@localhost:5432/chocks", `
        "DATABASE_URL=postgresql://postgres:mysecret@localhost:5432/chocks"
    
    Set-Content $envLocalPath $envContent
    Write-Host "✅ .env.local atualizado" -ForegroundColor Green
}

# Solicitar API key
Write-Host "`n🔑 Sua OpenAI API Key:" -ForegroundColor Cyan
$apiKey = Read-Host "Cole sua chave (ou pressione Enter para pular)"

if ($apiKey) {
    $envContent = Get-Content $envLocalPath -Raw
    $envContent = $envContent -replace `
        'OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE', `
        "OPENAI_API_KEY=$apiKey"
    Set-Content $envLocalPath $envContent
    Write-Host "✅ API key configurada!" -ForegroundColor Green
} else {
    Write-Host "⚠️ Lembre de adicionar sua API key em .env.local antes de rodar" -ForegroundColor Yellow
}

# NPM install
Write-Host "`n📦 Instalando dependências..." -ForegroundColor Cyan
npm install

# Done
Write-Host "`n✅ Setup completo!" -ForegroundColor Green
Write-Host "`nAgora execute:" -ForegroundColor Cyan
Write-Host "  npm run dev`n" -ForegroundColor Green
Write-Host "E acesse: http://localhost:3001" -ForegroundColor Green
