$ErrorActionPreference = "Continue"

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "🚀 Iniciando Sincronização de Ambiente (Automática)" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# 1. Verificar Build Local
Write-Host "`n[1/4] Executando build do projeto..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Falha no build! A sincronização foi abortada. Corrija os erros acima primeiro." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "✅ Build verificado com sucesso!" -ForegroundColor Green

# 2. Add e Commit no Git
Write-Host "`n[2/4] Verificando e salvando alterações no código (Git)..." -ForegroundColor Yellow
git add .
$gitStatus = git status --porcelain
if ($gitStatus) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    git commit -m "Auto-sync $timestamp: Atualizações gerais de código e correções"
    Write-Host "✅ Alterações salvas localmente." -ForegroundColor Green
} else {
    Write-Host "⚠️ Nenhuma nova alteração no código para salvar." -ForegroundColor Yellow
}

# 3. Push para Github (Isso aciona o deploy no Vercel automaticamente)
Write-Host "`n[3/4] Enviando código para o GitHub (Dispara Vercel)..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Falha ao enviar para o GitHub. Verifique sua conexão e acessos." -ForegroundColor Red
} else {
    Write-Host "✅ Código enviado ao GitHub. O Vercel iniciará o Deploy em instantes!" -ForegroundColor Green
}

# 4. Sincronizar Banco de Dados (Supabase)
Write-Host "`n[4/4] Atualizando regras e tabelas do banco de dados (Supabase)..." -ForegroundColor Yellow
npx supabase db push
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Não foi possível sincronizar o banco. Se você não estiver autenticado, rode: npx supabase login" -ForegroundColor Red
    Write-Host "Se você já vinculou o projeto antes, rode: npx supabase link --project-ref lcymbetnnuokrijynmjm" -ForegroundColor Yellow
} else {
    Write-Host "✅ Banco de dados sincronizado perfeitamente!" -ForegroundColor Green
}

Write-Host "`n===============================================" -ForegroundColor Cyan
Write-Host "🎉 Processo finalizado." -ForegroundColor Cyan
Write-Host "Acompanhe o painel do Vercel para o status do site final." -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
