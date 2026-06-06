#!/bin/bash
cd "$(dirname "$0")"

echo "=================================================="
echo "      Compilador do Robô no macOS"
echo "=================================================="

if ! command -v python3 &> /dev/null
then
    echo "[-] Python 3 não foi encontrado no seu Mac."
    echo "[*] Por favor, instale o Python 3 baixando de: https://www.python.org/downloads/"
    echo "Pressione qualquer tecla para sair..."
    read -n 1
    exit 1
fi

if [ ! -d "venv" ]; then
    echo "[+] Criando ambiente virtual Python (venv)..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "[+] Instalando dependências e PyInstaller..."
pip install --upgrade pip
pip install pyinstaller flask flask-cors instagrapi qrcode

echo "[+] Compilando com PyInstaller..."
pyinstaller --onefile --clean --paths "GUI_ADD/Ferramenta de disparo" server.py

if [ -f "dist/server" ]; then
    mv dist/server ./server_mac
    echo "[+] Limpando pastas temporárias..."
    rm -rf build dist server.spec
    echo "=================================================="
    echo "[OK] SUCESSO! O executável 'server_mac' foi gerado."
    echo "Para rodar o executável compile: ./server_mac"
    echo "=================================================="
else
    echo "[-] Erro ao compilar com PyInstaller."
fi

echo "Pressione qualquer tecla para sair..."
read -n 1
