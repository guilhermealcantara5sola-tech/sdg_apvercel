import tkinter as tk
from tkinter import messagebox, filedialog, scrolledtext
import threading
import json
import os
from core import InstagramBot

class InstagramGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Instagram DM Automation - Tenpheson")
        self.root.geometry("600x700")
        
        self.leads = []
        self.bot = None
        
        self.create_widgets()
        self.load_last_config()

    def create_widgets(self):
        # Frame de Credenciais
        frame_login = tk.LabelFrame(self.root, text="Acesso ao Instagram", padx=10, pady=10)
        frame_login.pack(padx=10, pady=5, fill="x")
        
        tk.Label(frame_login, text="Usuário:").grid(row=0, column=0, sticky="w")
        self.ent_user = tk.Entry(frame_login)
        self.ent_user.grid(row=0, column=1, sticky="ew", padx=5)
        
        tk.Label(frame_login, text="Senha:").grid(row=1, column=0, sticky="w")
        self.ent_pass = tk.Entry(frame_login, show="*")
        self.ent_pass.grid(row=1, column=1, sticky="ew", padx=5)
        
        frame_login.columnconfigure(1, weight=1)
        
        # Frame de Mensagem
        frame_msg = tk.LabelFrame(self.root, text="Mensagem e Delays", padx=10, pady=10)
        frame_msg.pack(padx=10, pady=5, fill="both", expand=True)
        
        tk.Label(frame_msg, text="Mensagem:").pack(anchor="w")
        self.txt_msg = scrolledtext.ScrolledText(frame_msg, height=5)
        self.txt_msg.pack(fill="both", expand=True, pady=5)
        
        frame_delays = tk.Frame(frame_msg)
        frame_delays.pack(fill="x")
        
        tk.Label(frame_delays, text="Delay Mín (s):").pack(side="left")
        self.ent_min_delay = tk.Entry(frame_delays, width=5)
        self.ent_min_delay.insert(0, "60")
        self.ent_min_delay.pack(side="left", padx=5)
        
        tk.Label(frame_delays, text="Delay Máx (s):").pack(side="left", padx=(10, 0))
        self.ent_max_delay = tk.Entry(frame_delays, width=5)
        self.ent_max_delay.insert(0, "120")
        self.ent_max_delay.pack(side="left", padx=5)
        
        # Frame de Leads
        frame_leads = tk.LabelFrame(self.root, text="Lista de Arrobas", padx=10, pady=10)
        frame_leads.pack(padx=10, pady=5, fill="x")
        
        # Entrada Manual
        tk.Label(frame_leads, text="Entrada Manual (separadas por vírgula):").pack(anchor="w")
        self.ent_manual_leads = tk.Entry(frame_leads)
        self.ent_manual_leads.pack(fill="x", pady=(0, 10))
        
        # Botão Carregar
        btn_frame = tk.Frame(frame_leads)
        btn_frame.pack(fill="x")
        
        self.btn_load = tk.Button(btn_frame, text="Carregar Arquivo (.txt ou .json)", command=self.load_file)
        self.btn_load.pack(side="left")
        
        self.lbl_status_leads = tk.Label(btn_frame, text="0 contatos de arquivo")
        self.lbl_status_leads.pack(side="left", padx=10)
        
        # Logs
        tk.Label(self.root, text="Log de Atividades:").pack(anchor="w", padx=10)
        self.txt_log = scrolledtext.ScrolledText(self.root, height=10, state='disabled', bg="#f0f0f0")
        self.txt_log.pack(padx=10, pady=5, fill="both", expand=True)
        
        # Botões de Ação
        frame_actions = tk.Frame(self.root, pady=10)
        frame_actions.pack(fill="x")
        
        self.btn_start = tk.Button(frame_actions, text="INICIAR DISPARO", bg="#4CAF50", fg="white", 
                                   font=("Arial", 10, "bold"), command=self.start_process)
        self.btn_start.pack(side="left", padx=10, expand=True, fill="x")
        
        self.btn_stop = tk.Button(frame_actions, text="PARAR", bg="#f44336", fg="white",
                                  command=self.stop_process, state='disabled')
        self.btn_stop.pack(side="left", padx=10, expand=True, fill="x")

    def log(self, message):
        self.txt_log.config(state='normal')
        self.txt_log.insert(tk.END, f"{message}\n")
        self.txt_log.see(tk.END)
        self.txt_log.config(state='disabled')

    def load_file(self):
        file_path = filedialog.askopenfilename(filetypes=[("Arquivos de texto", "*.txt"), ("Arquivos JSON", "*.json")])
        if not file_path:
            return
            
        try:
            if file_path.endswith('.json'):
                with open(file_path, 'r', encoding='utf-8') as f:
                    self.leads = json.load(f)
            else:
                with open(file_path, 'r', encoding='utf-8') as f:
                    self.leads = [line.strip() for line in f if line.strip()]
            
            self.lbl_status_leads.config(text=f"{len(self.leads)} contatos carregados")
            self.log(f"Arquivo carregado: {len(self.leads)} contatos.")
        except Exception as e:
            messagebox.showerror("Erro", f"Erro ao ler arquivo: {e}")

    def save_current_config(self):
        config = {
            "username": self.ent_user.get(),
            "message": self.txt_msg.get("1.0", tk.END).strip(),
            "min_delay": self.ent_min_delay.get(),
            "max_delay": self.ent_max_delay.get()
        }
        with open("last_config.json", "w", encoding="utf-8") as f:
            json.dump(config, f)

    def load_last_config(self):
        if os.path.exists("last_config.json"):
            try:
                with open("last_config.json", "r", encoding="utf-8") as f:
                    config = json.load(f)
                    self.ent_user.insert(0, config.get("username", ""))
                    self.txt_msg.insert("1.0", config.get("message", ""))
                    self.ent_min_delay.delete(0, tk.END)
                    self.ent_min_delay.insert(0, config.get("min_delay", "60"))
                    self.ent_max_delay.delete(0, tk.END)
                    self.ent_max_delay.insert(0, config.get("max_delay", "120"))
            except:
                pass

    def start_process(self):
        user = self.ent_user.get()
        password = self.ent_pass.get()
        msg = self.txt_msg.get("1.0", tk.END).strip()
        
        # Coleta leads manuais
        manual_leads_raw = self.ent_manual_leads.get().split(',')
        manual_leads = [l.strip() for l in manual_leads_raw if l.strip()]
        
        # Combina com os leads de arquivo
        all_leads = list(set(manual_leads + self.leads))
        
        if not user or not password or not msg or not all_leads:
            messagebox.showwarning("Aviso", "Preencha todos os campos e adicione pelo menos um contato (manual ou arquivo).")
            return
            
        try:
            min_d = int(self.ent_min_delay.get())
            max_d = int(self.ent_max_delay.get())
        except ValueError:
            messagebox.showwarning("Aviso", "Delays devem ser números inteiros.")
            return

        self.save_current_config()
        self.btn_start.config(state='disabled')
        self.btn_stop.config(state='normal')
        
        self.bot = InstagramBot(log_callback=self.log)
        
        # Rodar em uma thread separada
        thread = threading.Thread(target=self.run_bot, args=(user, password, all_leads, msg, min_d, max_d))
        thread.daemon = True
        thread.start()

    def run_bot(self, user, password, leads, msg, min_d, max_d):
        if self.bot.login(user, password):
            self.bot.send_dms(leads, msg, min_d, max_d)
        
        self.root.after(0, self.finish_process)

    def finish_process(self):
        self.btn_start.config(state='normal')
        self.btn_stop.config(state='disabled')
        messagebox.showinfo("Fim", "Processo concluído ou interrompido.")

    def stop_process(self):
        if self.bot:
            self.bot.stop()
            self.log("Solicitando interrupção...")

if __name__ == "__main__":
    root = tk.Tk()
    app = InstagramGUI(root)
    root.mainloop()
