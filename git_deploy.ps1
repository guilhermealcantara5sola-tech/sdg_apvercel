# Script de Deploy do Git com Seleção de Conta Interativa
# Configura o locale e encoding para UTF-8 no console do PowerShell
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "==================================================" -ForegroundColor Purple
Write-Host "         InstaManager - GIT DEPLOY AUTOMÁTICO     " -ForegroundColor Purple
Write-Host "==================================================" -ForegroundColor Purple

Write-Host "Escolha a conta do Git para assinar os commits localmente neste repositório:" -ForegroundColor Yellow
Write-Host "1) guilhermealcantara5sola-tech (guilhermealcantara5sola@gmail.com)"
Write-Host "2) graficargb2025-create (graficargb2025@gmail.com)"
Write-Host "3) Manter configuração atual (não alterar)"

$choice = Read-Host "Opção selecionada (1, 2 ou 3)"

if ($choice -eq "1") {
    git config user.name "guilhermealcantara5sola-tech"
    git config user.email "guilhermealcantara5sola@gmail.com"
    Write-Host "✓ Perfil configurado localmente: guilhermealcantara5sola-tech" -ForegroundColor Green
} elseif ($choice -eq "2") {
    git config user.name "graficargb2025-create"
    git config user.email "graficargb2025@gmail.com"
    Write-Host "✓ Perfil configurado localmente: graficargb2025-create" -ForegroundColor Green
} else {
    Write-Host "ℹ Mantendo perfil atual." -ForegroundColor Cyan
}

# Exibir perfil ativo atual
$activeUser = git config user.name
$activeEmail = git config user.email
Write-Host "Perfil atual de commit: $activeUser <$activeEmail>" -ForegroundColor Gray

Write-Host ""
$commitMsg = Read-Host "Digite a mensagem do commit"
if ([string]::IsNullOrWhiteSpace($commitMsg)) {
    $commitMsg = "Atualização de layout e scripts de deploy"
    Write-Host "Mensagem vazia. Usando mensagem padrão: '$commitMsg'" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Preparando arquivos..." -ForegroundColor Gray
git add .

Write-Host "Criando commit..." -ForegroundColor Gray
git commit -m "$commitMsg"

# Obter a branch atual
$branch = git branch --show-current
if ([string]::IsNullOrEmpty($branch)) {
    $branch = "main"
}

Write-Host "Enviando alterações para o repositório remoto (branch: $branch)..." -ForegroundColor Gray
git push origin $branch

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host "       DEPLOY ENVIADO COM SUCESSO PARA A VERCEL   " -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Red
    Write-Host "             ERRO AO ENVIAR PARA O GIT            " -ForegroundColor Red
    Write-Host "==================================================" -ForegroundColor Red
}
