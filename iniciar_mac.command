#!/bin/bash
# Move to the script's directory
cd "$(dirname "$0")"

echo "=================================================="
echo "      Inicializador do Robô no macOS"
echo "=================================================="

# Verifica se python3 está instalado
if ! command -v python3 &> /dev/null
then
    echo "[-] Python 3 não foi encontrado no seu Mac."
    echo "[*] Por favor, instale o Python 3 baixando de: https://www.python.org/downloads/"
    echo "Pressione qualquer tecla para sair..."
    read -n 1
    exit 1
fi

# Cria o ambiente virtual se não existir
if [ ! -d "venv" ]; then
    echo "[+] Criando ambiente virtual Python (venv)..."
    python3 -m venv venv
fi

# Ativa o ambiente virtual
echo "[+] Ativando ambiente virtual..."
source venv/bin/activate

# Instala/Atualiza dependências
echo "[+] Instalando dependências (Flask, Instagrapi, etc.)..."
pip install --upgrade pip
pip install flask flask-cors instagrapi qrcode

# Inicia o servidor
echo "[+] Iniciando o servidor do Robô..."
echo "[*] Deixe esta janela aberta enquanto usa o robô!"
echo "=================================================="
python server.py

# Se o servidor fechar, avisa o usuário
echo "=================================================="
echo "[-] O servidor foi encerrado."
echo "Pressione qualquer tecla para fechar..."
read -n 1
