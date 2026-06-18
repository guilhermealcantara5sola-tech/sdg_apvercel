import os
import sys
import json
import time
import random
import argparse
import requests
from playwright.sync_api import sync_playwright

# Configuração de Logs
def log(msg, level="INFO"):
    timestamp = time.strftime('%H:%M:%S')
    print(f"[{timestamp}] [{level}] {msg}")
    sys.stdout.flush()

class SMSActivateAPI:
    def __init__(self, api_key):
        self.api_key = api_key
        self.url = "https://api.sms-activate.org/stubs/handler_api.php"

    def get_balance(self):
        try:
            res = requests.get(f"{self.url}?api_key={self.api_key}&action=getBalance", timeout=10)
            if res.text.startswith("ACCESS_BALANCE:"):
                return float(res.text.split(":")[1])
            return 0.0
        except Exception as e:
            log(f"Erro ao verificar saldo SMS: {e}", "ERRO")
            return 0.0

    def get_number(self, country_code=73):
        url = f"{self.url}?api_key={self.api_key}&action=getNumber&service=ig&country={country_code}"
        res = requests.get(url, timeout=15)
        if res.text.startswith("ACCESS_NUMBER:"):
            parts = res.text.split(":")
            activation_id = parts[1]
            number = parts[2]
            return activation_id, number
        raise Exception(f"Resposta SMS-Activate inválida: {res.text}")

    def get_status(self, activation_id):
        url = f"{self.url}?api_key={self.api_key}&action=getStatus&id={activation_id}"
        res = requests.get(url, timeout=10)
        return res.text

    def set_status(self, activation_id, status_code):
        # 6 = completar ativação, 8 = cancelar
        url = f"{self.url}?api_key={self.api_key}&action=setStatus&status={status_code}&id={activation_id}"
        requests.get(url, timeout=10)

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
            log(f"Solicitando número de telefone (País ID: {args.country_code}) no SMS-Activate...", "SMS")
            activation_id, phone_number = sms_api.get_number(args.country_code)
            # Garante formato correto (+ no início)
            if not phone_number.startswith("+"):
                phone_number = f"+{phone_number}"
            log(f"Número obtido: {phone_number} (Ativação ID: {activation_id})", "SMS")
        except Exception as e:
            log(f"Falha ao obter número de SMS: {str(e)}", "ERRO")
            return False
    else:
        log("Nenhuma chave de SMS informada. O script tentará usar e-mail (altamente propenso a bloqueio).", "AVISO")
        # Criar um e-mail temporário simples
        email_suffix = "".join(random.choices("abcdefghijklmnopqrstuvwxyz", k=8))
        phone_number = f"sdg_temp_{email_suffix}@mailto.plus" # e-mail temporário fictício

    # Inicializar Playwright
    with sync_playwright() as p:
        browser_args = []
        if args.proxy:
            log(f"Utilizando proxy: {args.proxy}", "PROXY")
            # Exemplo de formato de proxy: ip:port:user:pass ou ip:port
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
            headless=False, # Modo headful obrigatório para resolução manual de captchas e acompanhamento
            args=browser_args,
            proxy=proxy_config
        )

        # Configurar contexto com idioma em português
        context = browser.new_context(
            locale="pt-BR",
            timezone_id="America/Sao_Paulo",
            viewport={"width": 1280, "height": 800}
        )
        page = context.new_page()

        try:
            log("Navegando para a página de cadastro do Instagram...", "INFO")
            page.goto("https://www.instagram.com/accounts/emailsignup/", wait_until="networkidle", timeout=60000)

            # Aceitar cookies se a janela aparecer
            try:
                cookie_buttons = page.query_selector_all("button:has-text('Permitir todos os cookies'), button:has-text('Aceitar tudo'), button:has-text('Accept')")
                if cookie_buttons:
                    cookie_buttons[0].click()
                    log("Cookies aceitos com sucesso.", "INFO")
                    time.sleep(2)
            except Exception:
                pass

            # Preencher campos de cadastro
            log("Preenchendo formulário de cadastro...", "INFO")
            page.fill("input[name='emailOrPhone']", phone_number)
            page.fill("input[name='fullName']", full_name)
            page.fill("input[name='username']", username)
            page.fill("input[name='password']", password)
            time.sleep(2)

            # Clicar em cadastrar
            log("Enviando dados de cadastro...", "INFO")
            submit_button = page.locator("button[type='submit']")
            submit_button.click()
            time.sleep(4)

            # Tela de aniversário (Instagram sempre pede data de nascimento)
            if "birthday" in page.url or page.query_selector("select[title='Mês:']") or page.query_selector("select[title='Month:']"):
                log("Preenchendo data de nascimento...", "INFO")
                # Localizar selects de aniversário
                selects = page.query_selector_all("select")
                if len(selects) >= 3:
                    # Selecionar mês (Mês index 0)
                    selects[0].select_option(index=random.randint(1, 12))
                    # Selecionar dia (Dia index 1)
                    selects[1].select_option(index=random.randint(1, 28))
                    # Selecionar ano (Ano index 2 - deve ter mais de 18 anos)
                    year_val = str(random.randint(1990, 2005))
                    selects[2].select_option(label=year_val)
                time.sleep(2)
                
                # Clicar em Avançar
                next_button = page.locator("button:has-text('Avançar'), button:has-text('Next')")
                if next_button.count() > 0:
                    next_button.first.click()
                else:
                    # Fallback click
                    page.locator("button").last.click()
                time.sleep(5)

            # Verificar se ocorreu algum CAPTCHA
            if "challenge" in page.url or page.query_selector("iframe[src*='arkose']"):
                log("AVISO: Captcha de segurança detectado! Por favor, resolva o Captcha na janela do navegador.", "AVISO")
                log("Aguardando você resolver o Captcha no navegador...", "AVISO")
                # Aguardar até que a página saia da url de challenge ou o iframe do captcha suma (limite de 3 minutos)
                for _ in range(36):
                    time.sleep(5)
                    if "challenge" not in page.url and not page.query_selector("iframe[src*='arkose']"):
                        log("SUCESSO: Captcha resolvido!", "INFO")
                        break
                else:
                    log("ERRO: Tempo limite excedido para resolução do Captcha.", "ERRO")
                    if sms_api and activation_id:
                        sms_api.set_status(activation_id, 8) # Cancelar ativação
                    browser.close()
                    return False

            # Código de confirmação recebido por SMS
            if sms_api and activation_id:
                log("Aguardando código de SMS do Instagram...", "SMS")
                sms_code = None
                # Polling de até 3 minutos
                for attempt in range(36):
                    status = sms_api.get_status(activation_id)
                    if status.startswith("STATUS_OK:"):
                        sms_code = status.split(":")[1]
                        log(f"Código recebido: {sms_code}", "SMS")
                        break
                    elif status == "STATUS_WAIT_CODE":
                        if attempt % 6 == 0:
                            log("Aguardando código SMS (verificando novamente em 5s)...", "SMS")
                    else:
                        log(f"Status SMS inesperado: {status}", "AVISO")
                    time.sleep(5)

                if not sms_code:
                    log("ERRO: Tempo esgotado para o código de SMS chegar.", "ERRO")
                    sms_api.set_status(activation_id, 8) # Cancelar
                    browser.close()
                    return False

                # Preencher o código recebido
                log("Inserindo código de verificação no Instagram...", "INFO")
                # Geralmente o input chama-se 'email_confirmation_code' ou 'confirmationCode'
                code_input = page.locator("input[name='email_confirmation_code'], input[name='confirmationCode'], input[placeholder='Código de confirmação']")
                if code_input.count() > 0:
                    code_input.first.fill(sms_code)
                else:
                    page.fill("input", sms_code) # último recurso

                time.sleep(2)
                
                # Clicar em avançar
                confirm_button = page.locator("button[type='submit'], button:has-text('Avançar'), button:has-text('Confirmar')")
                confirm_button.first.click()
                time.sleep(10)

            # Verificar se fomos para a página logada (Criada com sucesso!)
            log("Verificando se a conta foi criada e logada...", "INFO")
            
            # Instagram redireciona para home ou para a tela inicial
            success = False
            for _ in range(6):
                # Se mudou de URL e não contém mais cadastro/login
                if "instagram.com" in page.url and "signup" not in page.url and "emailsignup" not in page.url:
                    success = True
                    break
                # Ou se existe menu do perfil/home
                if page.query_selector("[aria-label='Página inicial'], [aria-label='Home'], [aria-label='Pesquisa'], a[href*='/accounts/edit/']"):
                    success = True
                    break
                time.sleep(3)

            if success:
                log(f"SUCESSO: Conta @{username} criada e validada com sucesso!", "SUCESSO")
                if sms_api and activation_id:
                    sms_api.set_status(activation_id, 6) # Concluir ativação com sucesso
                
                # Salvar no accounts.json local
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
                log("ERRO: Falha ao validar criação da conta. Pode ter ocorrido um bloqueio tardio do Instagram.", "ERRO")
                if sms_api and activation_id:
                    sms_api.set_status(activation_id, 8)
                browser.close()
                return False

        except Exception as e:
            log(f"Ocorreu um erro no fluxo do navegador: {str(e)}", "ERRO")
            if sms_api and activation_id:
                sms_api.set_status(activation_id, 8)
            try:
                browser.close()
            except Exception:
                pass
            return False

def main():
    parser = argparse.ArgumentParser(description="Criador Automático de Contas Instagram")
    parser.add_argument("--sms-key", help="Chave de API do SMS-Activate")
    parser.add_argument("--country-code", type=int, default=73, help="Código do país para o SMS (Padrão: 73 - Brasil)")
    parser.add_argument("--username-prefix", default="sdg", help="Prefixo dos usuários criados")
    parser.add_argument("--password", help="Senha padrão para as contas criadas (se omitido, será aleatória)")
    parser.add_argument("--proxy", help="Proxy no formato IP:PORTA ou IP:PORTA:USER:PASS")
    parser.add_argument("--count", type=int, default=1, help="Quantidade de contas para criar")
    
    args = parser.parse_args()

    log("==================================================", "INFO")
    log("   Criador Automático de Contas do Instagram      ", "INFO")
    log("==================================================", "INFO")

    sms_api = None
    if args.sms_key:
        sms_api = SMSActivateAPI(args.sms_key)
        balance = sms_api.get_balance()
        log(f"Conectado ao SMS-Activate. Saldo disponível: R$ {balance:.2f}", "SMS")
        if balance <= 0.0:
            log("AVISO: Seu saldo no SMS-Activate está zerado. A compra de números pode falhar.", "AVISO")
    else:
        log("Nenhuma chave de SMS informada. Tentando criar sem verificação de chip (não recomendado).", "AVISO")

    success_count = 0
    for idx in range(1, args.count + 1):
        log(f"\n--- Iniciando criação {idx}/{args.count} ---", "INFO")
        success = create_instagram_account(args, sms_api, idx)
        if success:
            success_count += 1
            # Intervalo entre criações para evitar suspeitas
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
