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
        settings['phone_number'] = phone_number
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
                content = f.read()
            if "--phone-number" in content:
                should_create = False
        except Exception:
            pass

    if should_create:
        try:
            # CREATOR_CODE_START
            creator_code = r"""import os
import sys
import json
import time
import random
import re
import argparse
import requests
from playwright.sync_api import sync_playwright

# Configuração de Logs
def log(msg, level="INFO"):
    timestamp = time.strftime('%H:%M:%S')
    print(f"[{timestamp}] [{level}] {msg}")
    sys.stdout.flush()

class FivesimAPI:
    def __init__(self, api_key):
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json"
        }
        self.url = "https://5sim.net/v1/user"

    def get_balance(self):
        try:
            res = requests.get(f"{self.url}/profile", headers=self.headers, timeout=10)
            if res.status_code == 200:
                return float(res.json().get("balance", 0.0))
            return 0.0
        except Exception as e:
            log(f"Erro ao verificar saldo 5sim: {e}", "ERRO")
            return 0.0

    def get_number(self, country="brazil"):
        # Instagram = instagram, operador = any
        url = f"{self.url}/buy/activation/{country}/any/instagram"
        res = requests.get(url, headers=self.headers, timeout=15)
        if res.status_code == 200:
            data = res.json()
            activation_id = data["id"]
            number = data["phone"]
            return activation_id, number
        raise Exception(f"Erro 5sim ao obter número (Status {res.status_code}): {res.text}")

    def get_sms_code(self, activation_id):
        url = f"{self.url}/check/{activation_id}"
        res = requests.get(url, headers=self.headers, timeout=10)
        if res.status_code == 200:
            data = res.json()
            sms_list = data.get("sms", [])
            if sms_list:
                # Retorna o código de ativação do primeiro SMS
                return sms_list[0].get("code") or sms_list[0].get("text")
        return None

    def finish_order(self, activation_id):
        url = f"{self.url}/finish/{activation_id}"
        requests.get(url, headers=self.headers, timeout=10)

    def cancel_order(self, activation_id):
        url = f"{self.url}/cancel/{activation_id}"
        requests.get(url, headers=self.headers, timeout=10)

class SmsActivateAPI:
    def __init__(self, api_key):
        self.api_key = api_key
        self.url = "https://sms-activate.org/stubs/handler_api.php"

    def get_balance(self):
        try:
            url = f"{self.url}?api_key={self.api_key}&action=getBalance"
            res = requests.get(url, timeout=10)
            if res.status_code == 200 and "ACCESS_BALANCE:" in res.text:
                return float(res.text.split(":")[1])
            return 0.0
        except Exception as e:
            log(f"Erro ao verificar saldo SMS-Activate: {e}", "ERRO")
            return 0.0

    def get_number(self, country="brazil"):
        # Mapeia brasil para 73, senao default 0 (Russia/global)
        country_id = "73" if country.lower() == "brazil" else "0"
        url = f"{self.url}?api_key={self.api_key}&action=getNumber&service=ig&country={country_id}"
        res = requests.get(url, timeout=15)
        if res.status_code == 200 and "ACCESS_NUMBER:" in res.text:
            parts = res.text.split(":")
            activation_id = parts[1]
            number = parts[2]
            return activation_id, number
        raise Exception(f"Erro SMS-Activate ao obter número (Status {res.status_code}): {res.text}")

    def get_sms_code(self, activation_id):
        url = f"{self.url}?api_key={self.api_key}&action=getStatus&id={activation_id}"
        res = requests.get(url, timeout=10)
        if res.status_code == 200 and "STATUS_OK:" in res.text:
            return res.text.split(":")[1]
        return None

    def finish_order(self, activation_id):
        url = f"{self.url}?api_key={self.api_key}&action=setStatus&status=6&id={activation_id}"
        requests.get(url, timeout=10)

    def cancel_order(self, activation_id):
        url = f"{self.url}?api_key={self.api_key}&action=setStatus&status=8&id={activation_id}"
        requests.get(url, timeout=10)

class ManualSmsAPI:
    def __init__(self, predefined_phone=None):
        if getattr(sys, 'frozen', False):
            self.base_dir = os.path.dirname(os.path.abspath(sys.executable))
        else:
            self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.flow_file = os.path.join(self.base_dir, 'creator_manual_flow.json')
        self.predefined_phone = predefined_phone.strip() if predefined_phone else None
        self._write_flow({"status": "idle"})

    def _read_flow(self):
        if os.path.exists(self.flow_file):
            try:
                with open(self.flow_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
        return {"status": "idle"}

    def _write_flow(self, data):
        try:
            with open(self.flow_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception:
            pass

    def get_balance(self):
        return 0.0

    def get_number(self, country):
        if self.predefined_phone:
            phone = self.predefined_phone
            if not phone.startswith("+"):
                phone = "+" + phone
            log(f"[MANUAL_SMS] Usando número de telefone pré-definido: {phone}", "SMS")
            self.predefined_phone = None  # Consumido
            return "manual_activation", phone

        self._write_flow({"status": "pending_phone"})
        log("[MANUAL_SMS] IMPORTANTE: Digite o número do chip no painel para continuar.", "SMS")
        while True:
            time.sleep(2)
            flow = self._read_flow()
            if flow.get("status") == "phone_submitted":
                phone = flow.get("phone_number")
                if phone:
                    if not phone.startswith("+"):
                        phone = "+" + phone
                    log(f"[MANUAL_SMS] Número do telefone recebido: {phone}", "SMS")
                    return "manual_activation", phone
            elif flow.get("status") == "idle":
                self._write_flow({"status": "pending_phone"})

    def get_sms_code(self, activation_id):
        self._write_flow({"status": "pending_code"})
        log("[MANUAL_SMS] Código SMS solicitado. Insira o código recebido no chip no painel.", "SMS")
        for _ in range(48): # 4 minutos max
            time.sleep(5)
            flow = self._read_flow()
            if flow.get("status") == "code_submitted":
                code = flow.get("code")
                if code:
                    log(f"[MANUAL_SMS] Código SMS recebido: {code}", "SMS")
                    return code
            elif flow.get("status") == "idle":
                self._write_flow({"status": "pending_code"})
        return None

    def finish_order(self, activation_id):
        self._write_flow({"status": "idle"})

    def cancel_order(self, activation_id):
        self._write_flow({"status": "idle"})

def get_sms_api(api_key, predefined_phone=None):
    clean_key = api_key.strip()
    if clean_key.lower() == "manual":
        log("Provedor detectado: Fluxo SMS Manual (Chip Próprio)", "SMS")
        return ManualSmsAPI(predefined_phone)

    # Chaves do SMS-Activate são tipidades hexadecimais de 32 caracteres (sem pontos)
    is_sms_activate = False
    if len(clean_key) == 32 and all(c in "0123456789abcdefABCDEF" for c in clean_key):
        is_sms_activate = True
    
    if is_sms_activate:
        log("Provedor detectado: SMS-Activate.org", "SMS")
        return SmsActivateAPI(clean_key)
    else:
        log("Provedor detectado: 5sim.net", "SMS")
        return FivesimAPI(clean_key)

def generate_random_name():
    first_names = [
        "Aline", "Amanda", "Beatriz", "Bruna", "Camila", "Carolina", "Daniela", "Eduarda",
        "Fernanda", "Gabriela", "Isabela", "Juliana", "Larissa", "Letícia", "Luana", "Mariana",
        "Natalia", "Patrícia", "Rafaela", "Sandra", "Tatiane", "Vanessa", "Yasmin",
        "Alexandre", "Bruno", "Daniel", "Diego", "Eduardo", "Felipe", "Gabriel", "Guilherme",
        "Gustavo", "Igor", "João", "Lucas", "Mateus", "Otávio", "Pedro", "Rafael", "Rodrigo"
    ]
    last_names = [
        "Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira",
        "Lima", "Gomes", "Costa", "Ribeiro", "Martins", "Carvalho", "Rocha", "Melo", "Barbosa"
    ]
    return f"{random.choice(first_names)} {random.choice(last_names)}"

def generate_random_password():
    chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$"
    return "".join(random.choice(chars) for _ in range(12))

def create_instagram_account(args, sms_api, account_idx):
    username_prefix = args.username_prefix or "sdg"
    # Adiciona sufixo aleatório para unicidade
    suffix = "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=5))
    username = f"{username_prefix}_{suffix}"
    password = args.password or generate_random_password()
    full_name = generate_random_name()

    log(f"Iniciando criação da conta {account_idx}: @{username} / Senha: {password}...", "INFO")

    activation_id = None
    phone_number = None

    if sms_api:
        try:
            provider_name = "SMS-Activate.org" if isinstance(sms_api, SmsActivateAPI) else "5sim.net"
            log(f"Solicitando número de telefone (País: {args.country}) no {provider_name}...", "SMS")
            activation_id, phone_number = sms_api.get_number(args.country)
            # Garante formato correto (+ no início)
            if not phone_number.startswith("+"):
                phone_number = f"+{phone_number}"
            log(f"Número obtido: {phone_number} (Ativação ID: {activation_id})", "SMS")
        except Exception as e:
            log(f"Falha ao obter número de SMS: {str(e)}", "ERRO")
            return False
    else:
        log("Nenhuma chave de SMS informada. O script tentará usar e-mail (altamente propenso a bloqueio).", "AVISO")
        email_suffix = "".join(random.choices("abcdefghijklmnopqrstuvwxyz", k=8))
        phone_number = f"sdg_temp_{email_suffix}@mailto.plus"

    # Inicializar Playwright
    with sync_playwright() as p:
        browser_args = ["--start-minimized"]
        if args.proxy:
            log(f"Utilizando proxy: {args.proxy}", "PROXY")
            proxy_parts = args.proxy.split(":")
            if len(proxy_parts) >= 4:
                proxy_config = {
                    "server": f"http://{proxy_parts[0]}:{proxy_parts[1]}",
                    "username": proxy_parts[2],
                    "password": proxy_parts[3]
                }
            elif len(proxy_parts) == 2:
                proxy_config = {
                    "server": f"http://{proxy_parts[0]}:{proxy_parts[1]}"
                }
            else:
                proxy_config = {
                    "server": args.proxy
                }
        else:
            proxy_config = None

        log("Abrindo navegador (modo visível)...", "INFO")
        browser = p.chromium.launch(
            headless=False, # Modo headful obrigatório para resolução manual de captchas
            args=browser_args,
            proxy=proxy_config
        )

        context = browser.new_context(
            locale="pt-BR",
            timezone_id="America/Sao_Paulo",
            viewport={"width": 1280, "height": 800}
        )
        page = context.new_page()

        try:
            log("Navegando para a página de cadastro do Instagram...", "INFO")
            page.goto("https://www.instagram.com/accounts/emailsignup/", wait_until="networkidle", timeout=60000)

            # Aceitar cookies se aparecer
            try:
                cookie_buttons = page.query_selector_all("button:has-text('Permitir todos os cookies'), button:has-text('Aceitar tudo'), button:has-text('Accept')")
                if cookie_buttons:
                    cookie_buttons[0].click()
                    log("Cookies aceitos.", "INFO")
                    time.sleep(2)
            except Exception:
                pass

            # Preencher formulário
            log("Preenchendo formulário de cadastro...", "INFO")
            try:
                page.fill("input[name='emailOrPhone']", phone_number, timeout=4000)
                page.fill("input[name='fullName']", full_name, timeout=4000)
                page.fill("input[name='username']", username, timeout=4000)
                page.fill("input[name='password']", password, timeout=4000)
            except Exception:
                log("Detectada nova interface de cadastro do Instagram/Meta. Usando seletores dinâmicos...", "INFO")
                # Seleciona os inputs com base na ordem e tipo na nova página
                text_inputs = page.locator("input[type='text']")
                password_input = page.locator("input[type='password']").first
                username_input = page.locator("input[type='search'], input[aria-label*='usuário']").first
                
                text_inputs.nth(0).fill(phone_number)
                text_inputs.nth(1).fill(full_name)
                password_input.fill(password)
                username_input.fill(username)

            # Preencher data de nascimento nos selects customizados (nova interface)
            try:
                day_dropdown = page.locator("[aria-label='Selecionar o dia'], [aria-label*='day' i], [aria-label*='dia' i]")
                month_dropdown = page.locator("[aria-label='Selecionar o mês'], [aria-label*='month' i], [aria-label*='mês' i]")
                year_dropdown = page.locator("[aria-label='Selecionar o ano'], [aria-label*='year' i], [aria-label*='ano' i]")
                
                if day_dropdown.count() > 0 or month_dropdown.count() > 0 or year_dropdown.count() > 0:
                    log("Preenchendo data de nascimento nos dropdowns customizados...", "INFO")
                    
                    # 1. Selecionar Dia (1 a 28)
                    day_val = str(random.randint(1, 28))
                    if day_dropdown.count() > 0:
                        day_dropdown.first.click()
                        time.sleep(1)
                        day_option = page.locator("[role='option']:visible").filter(has_text=re.compile(f"^{day_val}$"))
                        if day_option.count() > 0:
                            day_option.first.click()
                        else:
                            page.locator("[role='option']:visible").nth(int(day_val) - 1).click()
                        time.sleep(0.5)
                    
                    # 2. Selecionar Mês
                    months_pt = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
                    months_en = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
                    selected_idx = random.randint(0, 11)
                    month_pt = months_pt[selected_idx]
                    month_en = months_en[selected_idx]
                    
                    if month_dropdown.count() > 0:
                        month_dropdown.first.click()
                        time.sleep(1)
                        option_pt = page.locator("[role='option']:visible").filter(has_text=re.compile(f"^{month_pt}$", re.IGNORECASE))
                        if option_pt.count() > 0:
                            option_pt.first.click()
                        else:
                            option_en = page.locator("[role='option']:visible").filter(has_text=re.compile(f"^{month_en}$", re.IGNORECASE))
                            if option_en.count() > 0:
                                option_en.first.click()
                            else:
                                page.locator("[role='option']:visible").nth(selected_idx).click()
                        time.sleep(0.5)
                    
                    # 3. Selecionar Ano (1990 a 2005)
                    year_val = str(random.randint(1990, 2005))
                    if year_dropdown.count() > 0:
                        year_dropdown.first.click()
                        time.sleep(1)
                        year_option = page.locator("[role='option']:visible").filter(has_text=re.compile(f"^{year_val}$"))
                        if year_option.count() > 0:
                            year_option.first.click()
                        else:
                            year_opt = page.locator(f"[role='option']:visible:has-text('{year_val}')")
                            if year_opt.count() > 0:
                                year_opt.first.click()
                            else:
                                page.locator("[role='option']:visible").nth(random.randint(20, 35)).click()
                        time.sleep(0.5)
                    
                    log("Data de nascimento selecionada com sucesso nos dropdowns customizados.", "INFO")
                else:
                    # Fallback para selects nativos
                    selects = page.query_selector_all("select")
                    if len(selects) >= 3:
                        selects[0].select_option(index=random.randint(1, 28))
                        selects[1].select_option(index=random.randint(1, 12))
                        year_val = str(random.randint(1990, 2005))
                        selects[2].select_option(label=year_val)
                        log("Data de nascimento selecionada nos selects nativos.", "INFO")
            except Exception as e:
                log(f"Aviso ao preencher data de nascimento: {e}", "INFO")

            time.sleep(2)

            # Clicar em cadastrar
            log("Enviando dados de cadastro...", "INFO")
            try:
                submit_button = page.locator("button[type='submit']")
                submit_button.click(timeout=4000)
            except Exception:
                # Na nova interface do Meta, o botão é um span com texto exato "Enviar"
                page.get_by_text("Enviar", exact=True).last.click()
            time.sleep(4)

            # Tela de aniversário (caso apareça separada como na interface antiga)
            if "birthday" in page.url or page.query_selector("select[title='Mês:']") or page.query_selector("select[title='Month:']"):
                log("Preenchendo data de nascimento (etapa adicional)...", "INFO")
                selects = page.query_selector_all("select")
                if len(selects) >= 3:
                    selects[0].select_option(index=random.randint(1, 12))
                    selects[1].select_option(index=random.randint(1, 28))
                    year_val = str(random.randint(1990, 2005))
                    selects[2].select_option(label=year_val)
                time.sleep(2)
                
                next_button = page.locator("button:has-text('Avançar'), button:has-text('Next')")
                if next_button.count() > 0:
                    next_button.first.click()
                else:
                    page.locator("button").last.click()
                time.sleep(5)

            # CAPTCHA
            if "challenge" in page.url or page.query_selector("iframe[src*='arkose']"):
                log("AVISO: Captcha de segurança detectado! Por favor, resolva o Captcha na janela do navegador.", "AVISO")
                log("Aguardando você resolver o Captcha no navegador...", "AVISO")
                for _ in range(36):
                    time.sleep(5)
                    if "challenge" not in page.url and not page.query_selector("iframe[src*='arkose']"):
                        log("SUCESSO: Captcha resolvido!", "INFO")
                        break
                else:
                    log("ERRO: Tempo limite excedido para resolução do Captcha.", "ERRO")
                    if sms_api and activation_id:
                        sms_api.cancel_order(activation_id)
                    browser.close()
                    return False

            # Código de confirmação por SMS
            if sms_api and activation_id:
                is_manual = (sms_api.__class__.__name__ == "ManualSmsAPI")
                sms_code = None
                
                if is_manual:
                    # No fluxo manual, get_sms_code bloqueia internamente aguardando o usuário digitar no painel.
                    # Portanto, chamamos apenas UMA vez para evitar loops e resets de estado.
                    sms_code = sms_api.get_sms_code(activation_id)
                else:
                    provider_name = "SMS-Activate.org" if isinstance(sms_api, SmsActivateAPI) else "5sim.net"
                    log(f"Aguardando código de SMS do Instagram no {provider_name}...", "SMS")
                    # Polling de até 3 minutos
                    for attempt in range(36):
                        sms_code = sms_api.get_sms_code(activation_id)
                        if sms_code:
                            log(f"Código recebido: {sms_code}", "SMS")
                            break
                        if attempt % 6 == 0:
                            log("Aguardando código SMS (verificando novamente em 5s)...", "SMS")
                        time.sleep(5)

                if not sms_code:
                    log("ERRO: Tempo esgotado para o código de SMS chegar.", "ERRO")
                    sms_api.cancel_order(activation_id)
                    browser.close()
                    return False

                # Preencher o código recebido
                log("Inserindo código de verificação no Instagram...", "INFO")
                try:
                    # Tenta os seletores clássicos
                    code_input = page.locator("input[name='email_confirmation_code'], input[name='confirmationCode'], input[placeholder='Código de confirmação']")
                    if code_input.count() > 0:
                        code_input.first.fill(sms_code, timeout=5000)
                    else:
                        # Se não encontrar os clássicos, preenche o primeiro input de texto/número visível que representa o campo de código
                        page.locator("input[type='text']:visible, input[type='number']:visible, input:visible").first.fill(sms_code, timeout=5000)
                except Exception:
                    # Fallback genérico para preencher o primeiro input visível
                    try:
                        page.locator("input:visible").first.fill(sms_code, timeout=5000)
                    except Exception as e:
                        log(f"Erro ao preencher o código no input: {e}", "ERRO")

                time.sleep(2)
                
                log("Confirmando código...", "INFO")
                try:
                    confirm_button = page.locator("button[type='submit'], button:has-text('Avançar'), button:has-text('Confirmar')")
                    confirm_button.first.click(timeout=5000)
                except Exception:
                    # Fallback: clica no último botão visível ou elemento clicável com texto de confirmação
                    for btn_text in ["Confirmar", "Avançar", "Próximo", "Next", "Confirm", "Enviar"]:
                        btn = page.get_by_text(btn_text).last
                        if btn.count() > 0:
                            btn.click()
                            break
                time.sleep(10)

            # Verificar se fomos para a página logada ou se o usuário confirmou no painel
            log("Aguardando verificação final da conta...", "INFO")
            
            success = False
            is_manual = (sms_api and sms_api.__class__.__name__ == "ManualSmsAPI")
            
            if is_manual:
                sms_api._write_flow({
                    "status": "pending_user_confirmation",
                    "username": username,
                    "password": password
                })
                log(f"[MANUAL_SMS] IMPORTANTE: Verifique o navegador e clique em 'Confirmar e Salvar' no painel se a conta @{username} deu certo.", "SMS")
                
                # Aguarda confirmação do usuário por até 5 minutos (150 loops de 2s)
                for _ in range(150):
                    time.sleep(2)
                    flow = sms_api._read_flow()
                    if flow.get("status") == "user_confirmed":
                        success = True
                        log("[MANUAL_SMS] Criação de conta confirmada com sucesso pelo usuário no painel!", "SUCESSO")
                        break
                    elif flow.get("status") == "user_failed":
                        success = False
                        log("[MANUAL_SMS] Criação de conta marcada como falha pelo usuário no painel.", "ERRO")
                        break
                else:
                    log("[MANUAL_SMS] Tempo esgotado aguardando confirmação. Fazendo verificação automática...", "AVISO")
                    # Fallback auto check
                    for _ in range(6):
                        if "instagram.com" in page.url and "signup" not in page.url and "emailsignup" not in page.url:
                            success = True
                            break
                        if page.query_selector("[aria-label='Página inicial'], [aria-label='Home'], [aria-label='Pesquisa'], a[href*='/accounts/edit/']"):
                            success = True
                            break
                        time.sleep(3)
            else:
                # Checagem automática para provedores automáticos (5sim)
                for _ in range(6):
                    if "instagram.com" in page.url and "signup" not in page.url and "emailsignup" not in page.url:
                        success = True
                        break
                    if page.query_selector("[aria-label='Página inicial'], [aria-label='Home'], [aria-label='Pesquisa'], a[href*='/accounts/edit/']"):
                        success = True
                        break
                    time.sleep(3)

            if success:
                log(f"SUCESSO: Conta @{username} criada e validada com sucesso!", "SUCESSO")
                if sms_api and activation_id:
                    sms_api.finish_order(activation_id)
                
                # Salvar no accounts.json
                accounts_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'accounts.json')
                accounts_dict = {}
                if os.path.exists(accounts_file):
                    try:
                        with open(accounts_file, 'r', encoding='utf-8') as f:
                            accounts_dict = json.load(f)
                    except Exception:
                        pass
                
                accounts_dict[username] = password
                try:
                    with open(accounts_file, 'w', encoding='utf-8') as f:
                        json.dump(accounts_dict, f, indent=2, ensure_ascii=False)
                    log(f"Conta @{username} salva localmente no accounts.json!", "INFO")
                except Exception as ex:
                    log(f"Erro ao salvar conta no arquivo: {ex}", "ERRO")

                browser.close()
                return True
            else:
                log("ERRO: Falha ao validar criação da conta. A conta pode ter sido restrita.", "ERRO")
                if sms_api and activation_id:
                    sms_api.cancel_order(activation_id)
                browser.close()
                return False

        except Exception as e:
            log(f"Ocorreu um erro no fluxo do navegador: {str(e)}", "ERRO")
            if sms_api and activation_id:
                sms_api.cancel_order(activation_id)
            try:
                browser.close()
            except Exception:
                pass
            return False

def main():
    parser = argparse.ArgumentParser(description="Criador Automático de Contas Instagram (5sim.net)")
    parser.add_argument("--sms-key", help="Chave de API do 5sim.net")
    parser.add_argument("--country", default="brazil", help="País para o SMS no 5sim (Padrão: brazil)")
    parser.add_argument("--username-prefix", default="sdg", help="Prefixo dos usuários criados")
    parser.add_argument("--password", help="Senha padrão para as contas criadas (se omitido, será aleatória)")
    parser.add_argument("--proxy", help="Proxy no formato IP:PORTA ou IP:PORTA:USER:PASS")
    parser.add_argument("--count", type=int, default=1, help="Quantidade de contas para criar")
    parser.add_argument("--phone-number", help="Número de telefone pré-definido para ativação manual")
    
    args = parser.parse_args()

    log("==================================================", "INFO")
    log("   Criador Automático de Contas (5sim.net)        ", "INFO")
    log("==================================================", "INFO")

    sms_api = None
    if args.sms_key:
        sms_api = get_sms_api(args.sms_key, getattr(args, "phone_number", None))
        balance = sms_api.get_balance()
        provider_name = "SMS-Activate.org" if isinstance(sms_api, SmsActivateAPI) else ("Manual (Chip)" if isinstance(sms_api, ManualSmsAPI) else "5sim.net")
        log(f"Conectado ao {provider_name}. Saldo disponível: R$ {balance:.2f}", "SMS")
        if balance <= 0.0 and provider_name != "Manual (Chip)":
            log(f"AVISO: Seu saldo no {provider_name} está zerado. A compra de números pode falhar.", "AVISO")
    else:
        log("Nenhuma chave de SMS informada. Tentando criar sem verificação de chip (não recomendado).", "AVISO")

    success_count = 0
    for idx in range(1, args.count + 1):
        log(f"\n--- Iniciando criação {idx}/{args.count} ---", "INFO")
        success = create_instagram_account(args, sms_api, idx)
        if success:
            success_count += 1
            if idx < args.count:
                delay = random.randint(30, 60)
                log(f"Aguardando {delay} segundos antes de iniciar o próximo cadastro...", "INFO")
                time.sleep(delay)
        else:
            log(f"Falha na tentativa {idx}.", "ERRO")
            if idx < args.count:
                time.sleep(15)

    log("\n==================================================", "INFO")
    log(f" Processo concluído! Contas criadas com sucesso: {success_count}/{args.count}", "INFO")
    log("==================================================", "INFO")

if __name__ == "__main__":
    main()
"""
            # CREATOR_CODE_END
            with open(creator_path, 'w', encoding='utf-8') as f:
                f.write(creator_code)
        except Exception as e:
            print(f"Erro ao gerar creator.py: {e}")

if __name__ == '__main__':
    ensure_helper_files()
    print("\n" + "="*70)
    print("   INICIANDO SERVIDOR DO CRIADOR DE CONTAS (PORT 5001)")
    print("="*70)
    print(" Este servidor atua apenas na aba de 'Criar Contas'.")
    print(" Endereço: http://localhost:5001")
    print("="*70 + "\n")
    app.run(host='0.0.0.0', port=5001, debug=True)
