@echo off
title Instalador de Dependencias - Thenperson 2026
echo ==================================================
echo   Instalando Python e dependencias para o Criador
echo ==================================================
echo.

echo [+] Baixando instalador do Python 3.11...
powershell -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.8/python-3.11.8-amd64.exe' -OutFile 'python_setup.exe'"

echo [+] Instalando Python (modo silencioso, por favor aguarde)...
start /wait python_setup.exe /quiet InstallAllUsers=1 PrependPath=1 Include_launcher=1

echo [+] Removendo instalador temporario...
del python_setup.exe

echo [+] Atualizando variaveis de ambiente na sessao...
set PATH=%PATH%;C:\Program Files\Python311;C:\Program Files\Python311\Scripts;%USERPROFILE%\AppData\Local\Programs\Python\Python311;%USERPROFILE%\AppData\Local\Programs\Python\Python311\Scripts

echo [+] Verificando instalacao do Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [-] Erro: Nao foi possivel instalar ou encontrar o Python.
    echo Por favor, instale o Python manualmente em python.org e marque a opcao "Add Python to PATH".
    pause
    exit /b 1
)

echo [+] Instalando bibliotecas necessarias (Playwright, Requests)...
python -m pip install --upgrade pip
python -m pip install playwright requests
python -m playwright install chromium

echo.
echo ==================================================
echo   [OK] INSTALACAO CONCLUIDA COM SUCESSO!
echo   Agora voce pode usar o criador de contas no painel.
echo ==================================================
pause
