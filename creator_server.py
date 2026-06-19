import os
import sys
import json
import time
import threading
from flask import Flask, jsonify, request, send_file, Response
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Diretorios (Suporta script Python normal ou executavel compilado pelo PyInstaller)
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(os.path.abspath(sys.executable))
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

SETTINGS_FILE = os.path.join(BASE_DIR, 'settings.json')
ACCOUNTS_FILE = os.path.join(BASE_DIR, 'accounts.json')

bot_status = "idle"  # idle, running, completed, error, stopping
bot_logs = []
bot_progress = {"current": 0, "total": 0, "current_user": ""}
creator_process = None

def load_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_settings(settings):
    try:
        with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(settings, f, indent=2, ensure_ascii=False)
    except Exception:
        pass

def load_saved_accounts():
    if os.path.exists(ACCOUNTS_FILE):
        try:
            with open(ACCOUNTS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}

@app.route('/api/health')
def health():
    return jsonify({"status": "ok", "service": "creator-only"})

@app.route('/api/settings', methods=['GET'])
def get_settings():
    return jsonify(load_settings())

@app.route('/api/settings', methods=['POST'])
def save_settings_route():
    data = request.json or {}
    settings = load_settings()
    for k, v in data.items():
        settings[k] = v
    save_settings(settings)
    return jsonify({"status": "success", "message": "Configurações salvas!"})

# --- Fluxo de Ativação Manual por SMS ---
MANUAL_FLOW_FILE = os.path.join(BASE_DIR, 'creator_manual_flow.json')

def load_manual_flow():
    if os.path.exists(MANUAL_FLOW_FILE):
        try:
            with open(MANUAL_FLOW_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {"status": "idle"}

def save_manual_flow(data):
    try:
        with open(MANUAL_FLOW_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception:
        pass

@app.route('/api/manual-flow', methods=['GET'])
def get_manual_flow():
    return jsonify(load_manual_flow())

@app.route('/api/manual-flow', methods=['POST'])
def post_manual_flow():
    data = request.json or {}
    flow = load_manual_flow()
    action = data.get('action')
    if action == 'submit_phone':
        flow['status'] = 'phone_submitted'
        flow['phone_number'] = data.get('phone_number')
    elif action == 'submit_code':
        flow['status'] = 'code_submitted'
        flow['code'] = data.get('code')
    elif action == 'user_confirmed':
        flow['status'] = 'user_confirmed'
        # Salva imediatamente no accounts.json do creator_server para evitar race conditions
        username = flow.get('username')
        password = flow.get('password')
        if username and password:
            try:
                accounts_dict = load_saved_accounts()
                accounts_dict[username] = password
                with open(ACCOUNTS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(accounts_dict, f, indent=2, ensure_ascii=False)
                print(f"[creator_server] Conta @{username} salva imediatamente ao confirmar!")
            except Exception as e:
                print(f"[creator_server] Erro ao salvar conta imediatamente: {e}")
    elif action == 'user_failed':
        flow['status'] = 'user_failed'
    elif action == 'reset':
        flow = {"status": "idle"}
    save_manual_flow(flow)
    return jsonify({"status": "success", "flow": flow})

@app.route('/api/accounts/full', methods=['GET'])
def get_accounts_full():
    accounts_dict = load_saved_accounts()
    return jsonify([{"username": username, "password": password} for username, password in accounts_dict.items()])

@app.route('/api/bot/status')
def creator_status():
    global bot_status, bot_logs, bot_progress
    return jsonify({
        "status": bot_status,
        "progress": bot_progress,
        "logs": bot_logs
    })

@app.route('/api/bot/stop', methods=['POST'])
def creator_stop():
    global bot_status, bot_logs, creator_process
    if bot_status == "running" or bot_status == "stopping":
        bot_status = "stopping"
        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Solicitando interrupção da criação de contas...")
        if creator_process:
            try:
                creator_process.terminate()
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Processo de criação de contas encerrado.")
            except Exception as e:
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Erro ao encerrar criador: {e}")
        return jsonify({"status": "stopping"})
    return jsonify({"error": "O criador não está em execução"}), 400

@app.route('/api/accounts/create', methods=['POST'])
def accounts_create_route():
    global bot_status, bot_logs, creator_process, bot_progress
    if bot_status == "running":
        return jsonify({"error": "O processo de criação automática já está em execução"}), 400

    data = request.json or {}
    sms_key = data.get('sms_key', '').strip()
    country = data.get('country', 'brazil').strip()
    username_prefix = data.get('username_prefix', 'sdg').strip()
    password = data.get('password', '').strip()
    proxy = data.get('proxy', '').strip()
    phone_number = data.get('phone_number', '').strip()
    count = int(data.get('count', 1))

    # Salva configurações locais
    settings = load_settings()
    if sms_key:
        settings['sms_activate_key'] = sms_key
        settings['country'] = country
        settings['username_prefix'] = username_prefix
        settings['proxy'] = proxy
        save_settings(settings)
    else:
        sms_key = settings.get('sms_activate_key', '')
        country = settings.get('country', 'brazil')
        username_prefix = settings.get('username_prefix', 'sdg')
        proxy = settings.get('proxy', '')

    bot_logs.clear()
    bot_status = "running"
    bot_progress = {"current": 0, "total": count, "current_user": ""}

    def run_creator_process():
        global bot_status, creator_process, bot_progress
        import subprocess
        
        # Encontra o executável do Python correto
        python_exe = "python"
        if getattr(sys, 'frozen', False):
            possible_pythons = [
                "python",
                "python3",
                os.path.join(os.environ.get("USERPROFILE", ""), r"AppData\Local\Programs\Python\Python311\python.exe"),
                r"C:\Program Files\Python311\python.exe",
                os.path.join(os.environ.get("USERPROFILE", ""), r"AppData\Local\Programs\Python\Python311-32\python.exe"),
                r"C:\Program Files\Python311-32\python.exe",
            ]
            for py in possible_pythons:
                if os.path.isabs(py):
                    if os.path.exists(py):
                        python_exe = py
                        break
                else:
                    import shutil
                    if shutil.which(py):
                        python_exe = py
                        break
        else:
            python_exe = sys.executable

        cmd = [python_exe, os.path.join(BASE_DIR, "creator.py")]
        
        if sms_key:
            cmd.extend(["--sms-key", sms_key])
        if country:
            cmd.extend(["--country", country])
        if username_prefix:
            cmd.extend(["--username-prefix", username_prefix])
        if password:
            cmd.extend(["--password", password])
        if proxy:
            cmd.extend(["--proxy", proxy])
        if phone_number:
            cmd.extend(["--phone-number", phone_number])
        if count:
            cmd.extend(["--count", str(count)])

        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Iniciando processo de criação automática...")
        
        try:
            creator_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                cwd=BASE_DIR,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )

            for line in iter(creator_process.stdout.readline, ''):
                clean_line = line.strip()
                if clean_line:
                    bot_logs.append(clean_line)
                    
                    if "Iniciando criação da conta" in clean_line:
                        try:
                            parts = clean_line.split("da conta ")[1].split(":")
                            current_idx = int(parts[0])
                            current_user = parts[1].split("/")[0].strip().replace("@", "")
                            bot_progress["current"] = current_idx
                            bot_progress["current_user"] = current_user
                        except Exception:
                            pass
                    elif "SUCESSO: Conta" in clean_line:
                        try:
                            parts = clean_line.split("Conta ")[1].split(" criada")[0].strip().replace("@", "")
                            bot_progress["current_user"] = parts
                        except Exception:
                            pass

            creator_process.stdout.close()
            return_code = creator_process.wait()
            
            if return_code == 0:
                bot_status = "completed"
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Criação de contas concluída com sucesso!")
            else:
                if bot_status == "stopping":
                    bot_status = "idle"
                    bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Criação de contas interrompida pelo usuário.")
                else:
                    bot_status = "error"
                    bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Criação de contas finalizou com erro (Código: {return_code}).")

        except Exception as e:
            bot_status = "error"
            bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Erro fatal ao rodar processo criador: {str(e)}")
            if "FileNotFoundError" in str(type(e)) or "sistema não pode encontrar" in str(e):
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] DICA: O Python não está instalado nesta máquina ou não está no PATH.")
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Por favor, execute o arquivo 'instalar_python.bat' na raiz do sistema para instalar automaticamente!")

        finally:
            creator_process = None

    threading.Thread(target=run_creator_process).start()
    return jsonify({"status": "started", "message": "Processo de criação automática de contas iniciado!"})

@app.route('/api/accounts/export', methods=['GET'])
def export_accounts_txt():
    accounts_dict = load_saved_accounts()
    content = ""
    for username, password in accounts_dict.items():
        content += f"{username}:{password}\n"
    return Response(
        content,
        mimetype="text/plain",
        headers={"Content-disposition": "attachment; filename=contas_geradas.txt"}
    )

@app.route('/api/accounts/export-json', methods=['GET'])
def export_accounts_json():
    if os.path.exists(ACCOUNTS_FILE):
        return send_file(ACCOUNTS_FILE, as_attachment=True, download_name="contas_geradas.json")
    else:
        return jsonify({"error": "Nenhuma conta gerada ainda"}), 404

def ensure_helper_files():
    # 1. criar instalar_python.bat
    bat_installer_path = os.path.join(BASE_DIR, 'instalar_python.bat')
    if not os.path.exists(bat_installer_path):
        try:
            content = r"""@echo off
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
pause"""
            with open(bat_installer_path, 'w', encoding='utf-8') as f:
                f.write(content)
        except Exception as e:
            print(f"Erro ao gerar instalar_python.bat: {e}")

    # 2. criar creator.py
    creator_path = os.path.join(BASE_DIR, 'creator.py')
    should_create = True
    if os.path.exists(creator_path):
        try:
            with open(creator_path, 'r', encoding='utf-8') as f:
                existing_content = f.read()
            if "country-code" in existing_content or "FivesimAPI" not in existing_content:
                should_create = True
            else:
                should_create = False
        except Exception:
            pass

    if should_create:
        try:
            # Tenta ler do arquivo local creator.py se existir, caso contrario grava o template
            # Como creator_server e server estao na mesma pasta, as chances sao de que creator.py ja existe.
            # Mas se for executado em pasta vazia, escreve o template.
            # Para manter o script enxuto, se ja tiver no diretorio de trabalho, apenas mantemos.
            pass
        except Exception:
            pass

if __name__ == '__main__':
    ensure_helper_files()
    print("\n" + "="*70)
    print("   INICIANDO SERVIDOR DO CRIADOR DE CONTAS (PORT 5001)")
    print("="*70)
    print(" Este servidor atua apenas na aba de 'Criar Contas'.")
    print(" Endereço: http://localhost:5001")
    print("="*70 + "\n")
    app.run(host='0.0.0.0', port=5001, debug=True)
