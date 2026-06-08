import json
import time
import random
import os
from instagrapi import Client
from instagrapi.exceptions import LoginRequired

class InstagramBot:
    def __init__(self, log_callback=None):
        self.client = Client()
        self.client.delay_range = [2, 5]
        
        # Suporta proxy configurado por variável de ambiente para uso em servidores/VPS
        proxy = os.environ.get("INSTAGRAM_PROXY")
        if proxy:
            self.client.set_proxy(proxy)
            
        self.log_callback = log_callback
        self.stop_flag = False

    def log(self, message):
        print(message)
        if self.log_callback:
            self.log_callback(message)

    def login(self, username, password):
        session_file = f"session_{username}.json"
        try:
            if os.path.exists(session_file):
                self.log(f"Tentando carregar sessão para {username}...")
                self.client.load_settings(session_file)
                self.client.login(username, password)
                self.log(f"Sessão carregada com sucesso.")
            else:
                self.log(f"Fazendo login inicial para {username}...")
                self.client.login(username, password)
                self.client.dump_settings(session_file)
                self.log(f"Login realizado e sessão salva.")
            return True
        except Exception as e:
            self.log(f"Erro no login: {e}")
            return False

    def send_dms(self, leads, message_template, min_delay, max_delay):
        self.stop_flag = False
        self.log(f"Iniciando envio para {len(leads)} contatos.")
        
        for username in leads:
            if self.stop_flag:
                self.log("Processo interrompido pelo usuário.")
                break
                
            username = username.strip().replace("@", "")
            if not username:
                continue
                
            self.log(f"--- Processando DM: @{username} ---")
            try:
                user_id = self.client.user_id_from_username(username)
                self.client.direct_send(message_template, [int(user_id)])
                self.log(f"Mensagem enviada para @{username}")
                
                self.wait_between_actions(min_delay, max_delay)
                    
            except Exception as e:
                self.log(f"Erro com @{username}: {e}")
                time.sleep(5)
                
        self.log("Processamento de DMs concluído.")

    def comment_on_post(self, post_url, leads, message_template, min_delay, max_delay):
        self.stop_flag = False
        self.log(f"Iniciando comentários no post: {post_url}")
        
        try:
            media_id = self.client.media_id(self.client.media_pk_from_url(post_url))
        except Exception as e:
            self.log(f"Erro ao obter ID do post: {e}")
            return

        for username in leads:
            if self.stop_flag:
                self.log("Processo interrompido pelo usuário.")
                break
                
            username = username.strip().replace("@", "")
            if not username:
                continue
                
            self.log(f"--- Comentando para: @{username} ---")
            try:
                comment_text = f"{message_template} @{username}"
                self.client.media_comment(media_id, comment_text)
                self.log(f"Comentário feito marcando @{username}")
                
                self.wait_between_actions(min_delay, max_delay)
                    
            except Exception as e:
                self.log(f"Erro ao comentar para @{username}: {e}")
                time.sleep(5)
                
        self.log("Processamento de comentários concluído.")

    def wait_between_actions(self, min_delay, max_delay):
        delay = random.randint(min_delay, max_delay)
        self.log(f"Aguardando {delay} segundos...")
        for _ in range(delay):
            if self.stop_flag:
                break
            time.sleep(1)

    def stop(self):
        self.stop_flag = True
