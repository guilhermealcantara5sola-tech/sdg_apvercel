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
                
            self.log(f"--- Processando: @{username} ---")
            try:
                user_id = self.client.user_id_from_username(username)
                self.client.direct_send(message_template, [int(user_id)])
                self.log(f"Mensagem enviada para @{username}")
                
                delay = random.randint(min_delay, max_delay)
                self.log(f"Aguardando {delay} segundos...")
                
                # Sleep em pequenos intervalos para checar stop_flag
                for _ in range(delay):
                    if self.stop_flag:
                        break
                    time.sleep(1)
                    
            except Exception as e:
                self.log(f"Erro com @{username}: {e}")
                time.sleep(5)
                
        self.log("Processamento concluído.")

    def stop(self):
        self.stop_flag = True
