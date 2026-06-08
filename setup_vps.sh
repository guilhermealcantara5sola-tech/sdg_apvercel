#!/usr/bin/env bash

# Script de configuração automática do servidor SDG_AP na VPS
# Para executar na VPS:
# 1. Copie este arquivo para a VPS
# 2. Rode: chmod +x setup_vps.sh
# 3. Rode: ./setup_vps.sh

echo "=========================================================="
echo " Iniciando configuração do Servidor SDG_AP na VPS"
echo "=========================================================="

# 1. Atualizar o sistema
echo "[1/6] Atualizando pacotes do sistema..."
sudo apt update && sudo apt upgrade -y

# 2. Instalar dependências necessárias
echo "[2/6] Instalar dependências (Python3, Pip, Virtualenv)..."
sudo apt install python3 python3-pip python3-venv git -y

# 3. Criar diretório do projeto e preparar ambiente
echo "[3/6] Criando diretório e ambiente virtual..."
mkdir -p ~/sdg_ap_server
cd ~/sdg_ap_server
python3 -m venv venv
source venv/bin/activate

# 4. Instalar bibliotecas Python
echo "[4/6] Instalar pacotes pip (flask, flask-cors, instagrapi)..."
pip install --upgrade pip
pip install flask flask-cors instagrapi

# 5. Criar arquivo de serviço Systemd para rodar em segundo plano
echo "[5/6] Configurando serviço em segundo plano (systemd)..."
sudo bash -c 'cat > /etc/systemd/system/sdg-bot.service <<EOF
[Unit]
Description=Servidor de Disparo Instagram SDG_AP
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/sdg_ap_server
ExecStart=/home/ubuntu/sdg_ap_server/venv/bin/python server.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF'

# Recarregar o systemd
sudo systemctl daemon-reload

echo "=========================================================="
echo " Configuração básica concluída com sucesso!"
echo " Próximos Passos:"
echo " 1. Envie os arquivos do servidor (server.py, core.py, etc.) para: /home/ubuntu/sdg_ap_server"
echo " 2. (Opcional) Defina a variável de ambiente INSTAGRAM_PROXY caso use proxy."
echo " 3. Inicie o serviço com: sudo systemctl start sdg-bot"
echo " 4. Habilite a inicialização automática com: sudo systemctl enable sdg-bot"
echo "=========================================================="
