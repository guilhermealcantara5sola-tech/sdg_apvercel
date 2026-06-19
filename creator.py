import os
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
        browser_args = []
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
                day_dropdown = page.locator("[aria-label='Selecionar o dia']")
                month_dropdown = page.locator("[aria-label='Selecionar o mês']")
                year_dropdown = page.locator("[aria-label='Selecionar o ano']")
                
                if day_dropdown.count() > 0 and month_dropdown.count() > 0 and year_dropdown.count() > 0:
                    log("Preenchendo data de nascimento nos dropdowns customizados...", "INFO")
                    
                    # 1. Selecionar Dia (1 a 28)
                    day_val = str(random.randint(1, 28))
                    day_dropdown.click()
                    time.sleep(1)
                    page.locator("[role='option']:visible").filter(has_text=re.compile(f"^{day_val}$")).first.click()
                    time.sleep(0.5)
                    
                    # 2. Selecionar Mês
                    months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
                    month_val = random.choice(months)
                    month_dropdown.click()
                    time.sleep(1)
                    page.locator("[role='option']:visible").filter(has_text=re.compile(f"^{month_val}$")).first.click()
                    time.sleep(0.5)
                    
                    # 3. Selecionar Ano (1990 a 2005)
                    year_val = str(random.randint(1990, 2005))
                    year_dropdown.click()
                    time.sleep(1)
                    page.locator("[role='option']:visible").filter(has_text=re.compile(f"^{year_val}$")).first.click()
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
                provider_name = "SMS-Activate.org" if isinstance(sms_api, SmsActivateAPI) else "5sim.net"
                log(f"Aguardando código de SMS do Instagram no {provider_name}...", "SMS")
                sms_code = None
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

            # Verificar se fomos para a página logada
            log("Verificando se a conta foi criada e logada...", "INFO")
            
            success = False
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
