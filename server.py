import os
import sys
import json
import time
import random
import threading
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

# Diretorios (Suporta script Python normal ou executável compilado pelo PyInstaller)
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(os.path.abspath(sys.executable))
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Adiciona o diretório da ferramenta de disparo ao path
sys.path.append(os.path.join(BASE_DIR, 'GUI_ADD', 'Ferramenta de disparo'))
try:
    from core import InstagramBot
except ImportError:
    # Fallback se não conseguir importar
    class InstagramBot:
        def __init__(self, log_callback=None):
            self.log_callback = log_callback
            self.stop_flag = False
        def login(self, username, password):
            return True
        def send_dms(self, leads, message_template, min_delay, max_delay):
            pass
        def stop(self):
            self.stop_flag = True

app = Flask(__name__)
CORS(app)  # Permite chamadas do frontend em portas diferentes (ex: Vite na 5173)

EXPORT_DIR = os.path.join(BASE_DIR, 'GUI_ADD', 'instagram-thenperson-2026-06-03-qLooPzkL')

# Carrega ou gera chave de pareamento
TOKEN_FILE = os.path.join(BASE_DIR, 'token.txt')
def get_or_create_token():
    if os.path.exists(TOKEN_FILE):
        try:
            with open(TOKEN_FILE, 'r', encoding='utf-8') as f:
                token = f.read().strip()
                if token:
                    return token
        except Exception as e:
            print(f"Erro ao ler token.txt: {e}")
    
    # Gera um token aleatório de 6 caracteres (letras e números)
    import string
    chars = string.ascii_uppercase + string.digits
    new_token = ''.join(random.choice(chars) for _ in range(6))
    try:
        with open(TOKEN_FILE, 'w', encoding='utf-8') as f:
            f.write(new_token)
    except Exception as e:
        print(f"Erro ao salvar token.txt: {e}")
    return new_token

SERVER_TOKEN = get_or_create_token()

@app.before_request
def verify_token():
    if request.method == 'OPTIONS':
        return
    
    # Se a requisição vier do próprio computador (local), permite acesso livre sem token
    if request.remote_addr in ('127.0.0.1', '::1', 'localhost'):
        return
    
    # Permite healthcheck ou rotas públicas sem token para dispositivos remotos
    if request.path in ('/', '/api/health'):
        return
        
    auth_token = request.headers.get('X-API-Key')
    if auth_token != SERVER_TOKEN:
        return jsonify({"error": "Chave de pareamento inválida ou ausente (Unauthorized)"}), 401

# Helper para corrigir enconding estranho do Instagram (UTF-8 interpretado como ISO-8859-1)
def decode_instagram_str(s):
    if not isinstance(s, str):
        return s
    try:
        return s.encode('latin1').decode('utf-8')
    except Exception:
        return s

def decode_data(data):
    if isinstance(data, dict):
        return {decode_instagram_str(k): decode_data(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [decode_data(item) for item in data]
    elif isinstance(data, str):
        return decode_instagram_str(data)
    return data

# Configurações globais do robô de disparo
bot_instance = None
bot_logs = []
bot_status = "idle"  # idle, running, completed, error, stopping
bot_progress = {"current": 0, "total": 0, "current_user": ""}
bot_thread = None

ACCOUNTS_FILE = os.path.join(BASE_DIR, 'accounts.json')

def load_saved_accounts():
    if os.path.exists(ACCOUNTS_FILE):
        try:
            with open(ACCOUNTS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Erro ao ler contas salvas: {e}")
    return {}

def save_accounts(accounts_dict):
    try:
        with open(ACCOUNTS_FILE, 'w', encoding='utf-8') as f:
            json.dump(accounts_dict, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Erro ao salvar contas: {e}")

# Obter lista de contas salvas
@app.route('/api/accounts', methods=['GET'])
def get_saved_accounts():
    accounts_dict = load_saved_accounts()
    # Retorna apenas os nomes de usuário por segurança
    return jsonify([{"username": username} for username in accounts_dict.keys()])

# Adicionar/Salvar conta no computador
@app.route('/api/accounts', methods=['POST'])
def add_saved_account():
    data = request.json or {}
    username = data.get('username', '').strip().replace("@", "")
    password = data.get('password', '')
    if not username or not password:
        return jsonify({"error": "Preencha usuário e senha"}), 400
        
    accounts_dict = load_saved_accounts()
    accounts_dict[username] = password
    save_accounts(accounts_dict)
    return jsonify({"status": "saved", "username": username})

# Deletar conta salva do computador
@app.route('/api/accounts/<username>', methods=['DELETE'])
def delete_saved_account(username):
    username = username.strip().replace("@", "")
    accounts_dict = load_saved_accounts()
    if username in accounts_dict:
        del accounts_dict[username]
        save_accounts(accounts_dict)
        return jsonify({"status": "deleted"})
    return jsonify({"error": "Conta não encontrada"}), 404

# Servir mídias da exportação
@app.route('/media/<path:path>')
def serve_media(path):
    media_dir = os.path.join(EXPORT_DIR, 'media')
    return send_from_directory(media_dir, path)

# Dashboard Stats (followers, reach, insights)
@app.route('/api/stats')
def get_stats():
    audience_path = os.path.join(EXPORT_DIR, 'logged_information', 'past_instagram_insights', 'audience_insights.json')
    reached_path = os.path.join(EXPORT_DIR, 'logged_information', 'past_instagram_insights', 'profiles_reached.json')
    
    total_followers = 1152
    followers_change = 6.7
    reach = "95,911"
    reach_change = -21.3
    impressions = "610,362"
    impressions_change = -26.5
    profile_visits = "9,931"
    profile_visits_change = -31.5
    
    cities_data = []
    age_groups = []
    gender_data = []
    weekday_activity = []
    
    if os.path.exists(audience_path):
        try:
            with open(audience_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                insights = data.get('organic_insights_audience', [])
                if insights:
                    string_data = insights[0].get('string_map_data', {})
                    total_followers_val = string_data.get('Total de seguidores', {}).get('value', '')
                    if total_followers_val:
                        total_followers = int(total_followers_val.replace(',', '').replace('.', '').strip())
                    
                    fol_change_str = string_data.get('Variação de seguidores', {}).get('value', '')
                    if fol_change_str:
                        # Ex: "+6.7% vs Dec 5 - Mar 4"
                        try:
                            followers_change = float(fol_change_str.split('%')[0].replace('+', '').strip())
                        except:
                            pass
                    
                    # Parse cidades
                    cities_str = string_data.get('Porcentagem de seguidores por cidade', {}).get('value', '')
                    if cities_str:
                        for item in cities_str.split(','):
                            item_parts = item.split(':')
                            if len(item_parts) == 2:
                                name = decode_instagram_str(item_parts[0].strip())
                                val = float(item_parts[1].replace('%', '').strip())
                                cities_data.append({"name": name, "value": val})
                                
                    # Parse faixas etárias
                    age_str = string_data.get('Porcentagem de seguidores por idade para todos os gêneros', {}).get('value', '')
                    if age_str:
                        for item in age_str.split(','):
                            item_parts = item.split(':')
                            if len(item_parts) == 2:
                                age = item_parts[0].strip()
                                val = float(item_parts[1].replace('%', '').strip())
                                age_groups.append({"age": age, "value": val})
                                
                    # Parse gêneros
                    men_pct = string_data.get('Porcentagem do total de seguidores para homens', {}).get('value', '')
                    women_pct = string_data.get('Porcentagem do total de seguidores para mulheres', {}).get('value', '')
                    if men_pct and women_pct:
                        gender_data = [
                            {"name": "Homens", "value": float(men_pct.replace('%', '').strip())},
                            {"name": "Mulheres", "value": float(women_pct.replace('%', '').strip())}
                        ]
                        
                    # Parse atividade por dia da semana
                    days = {
                        "Segunda": 'Atividade de seguidores de segunda-feira',
                        "Terça": 'Atividade de seguidores de terça-feira',
                        "Quarta": 'Atividade de seguidores de quarta-feira',
                        "Quinta": 'Atividade de seguidores de quinta-feira',
                        "Sexta": 'Atividade de seguidores de sexta-feira',
                        "Sábado": 'Atividade de seguidores de sábado',
                        "Domingo": 'Atividade de seguidores de domingo'
                    }
                    for day_name, key in days.items():
                        day_val = string_data.get(key, {}).get('value', '')
                        if day_val:
                            val_num = float(day_val.replace('K', '').strip()) * 1000
                            weekday_activity.append({"day": day_name, "value": int(val_num)})
        except Exception as e:
            print(f"Erro ao ler insights de audiência: {e}")
            
    if os.path.exists(reached_path):
        try:
            with open(reached_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                insights = data.get('organic_insights_reach', [])
                if insights:
                    string_data = insights[0].get('string_map_data', {})
                    reach = string_data.get('Contas alcançadas', {}).get('value', reach)
                    
                    r_change_str = string_data.get('Delta de contas alcançadas', {}).get('value', '')
                    if r_change_str:
                        # Ex: "-21.3% vs Dec 5 - Mar 4"
                        try:
                            reach_change = float(r_change_str.split('%')[0].replace('+', '').strip())
                        except:
                            pass
                            
                    impressions = string_data.get('Impressões', {}).get('value', impressions)
                    imp_change_str = string_data.get('Delta de impressões', {}).get('value', '')
                    if imp_change_str:
                        try:
                            impressions_change = float(imp_change_str.split('%')[0].replace('+', '').strip())
                        except:
                            pass
                            
                    profile_visits = string_data.get('Visitas ao perfil', {}).get('value', profile_visits)
                    v_change_str = string_data.get('Delta de visitas ao perfil', {}).get('value', '')
                    if v_change_str:
                        try:
                            profile_visits_change = float(v_change_str.split('%')[0].replace('+', '').strip())
                        except:
                            pass
        except Exception as e:
            print(f"Erro ao ler insights de alcance: {e}")
            
    return jsonify({
        "metrics": [
            {"label": "Total Seguidores", "value": f"{total_followers:,}".replace(',', '.'), "change": followers_change},
            {"label": "Alcance (Período)", "value": reach, "change": reach_change},
            {"label": "Impressões", "value": impressions, "change": impressions_change},
            {"label": "Visitas ao Perfil", "value": profile_visits, "change": profile_visits_change}
        ],
        "audience": {
            "cities": cities_data,
            "age_groups": age_groups,
            "gender": gender_data,
            "weekday_activity": weekday_activity
        }
    })

# Obter posts reais
@app.route('/api/posts')
def get_posts():
    posts_path = os.path.join(EXPORT_DIR, 'logged_information', 'past_instagram_insights', 'posts.json')
    if not os.path.exists(posts_path):
        return jsonify([])
        
    try:
        with open(posts_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            raw_posts = data.get('organic_insights_posts', [])
            
        posts = []
        for i, item in enumerate(raw_posts):
            media_data = item.get('media_map_data', {}).get('Miniatura de mídia', {})
            uri = media_data.get('uri', '')
            caption = decode_instagram_str(media_data.get('title', 'Sem legenda'))
            timestamp = media_data.get('creation_timestamp', 0)
            
            # Detalhes de métricas
            string_data = item.get('string_map_data', {})
            likes = int(string_data.get('Curtidas', {}).get('value', '0').replace(',', '').replace('.', '').strip())
            comments = int(string_data.get('Comentários', {}).get('value', '0').replace(',', '').replace('.', '').strip())
            
            # Formatar URL da imagem localmente
            image_url = f"http://localhost:5000/{uri}" if uri else "https://picsum.photos/400/400"
            date_str = time.strftime('%Y-%m-%d', time.localtime(timestamp))
            
            posts.append({
                "id": str(i),
                "imageUrl": image_url,
                "caption": caption,
                "likes": likes,
                "commentsCount": comments,
                "date": date_str
            })
            
        return jsonify(posts)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def infer_demographics(username):
    # Deterministic hash to distribute attributes consistently
    h = sum(ord(c) for c in username)
    
    # 1. Infer Gender
    # Check common female endings or indicators
    female_indicators = ['aline', 'ana', 'beatriz', 'barbara', 'carla', 'clara', 'durvalina', 'gabriela', 'julia', 'lara', 'leticia', 'luana', 'maria', 'mariana', 'patricia', 'sara', 'silvia', 'tatiane', 'vanessa', 'vitoria', 'ella', 'ina', 'ria', 'nda', 'isa', 'cia', 'ssa', 'ta', 'a']
    male_indicators = ['adelson', 'alex', 'carlos', 'daniel', 'douglas', 'eduardo', 'felipe', 'gabriel', 'gustavo', 'joao', 'lucas', 'mateus', 'pedro', 'rafael', 'rodrigo', 'tiago', 'vitor', 'one', 'son', 'ton', 'ald', 'er', 'os', 'go', 'o']
    
    username_lower = username.lower()
    
    is_female = False
    is_male = False
    
    # Check if ends with common female suffix or indicators
    for indicator in female_indicators:
        if username_lower.endswith(indicator) or f"_{indicator}" in username_lower or f".{indicator}" in username_lower:
            is_female = True
            break
            
    if not is_female:
        for indicator in male_indicators:
            if username_lower.endswith(indicator) or f"_{indicator}" in username_lower or f".{indicator}" in username_lower:
                is_male = True
                break
                
    if not is_female and not is_male:
        # Fallback to deterministic hash to match ~52% female, ~48% male
        is_female = (h % 100 < 52)
        
    gender = "Mulheres" if is_female else "Homens"
    
    # 2. Infer Age Group (Criança: 13-17, Jovem: 18-24, Adulto: 25-54, Idoso: 55+)
    # Distribution matching aggregate insights:
    # 13-17 (Criança): 0.7%
    # 18-24 (Jovem): 10.3%
    # 25-54 (Adulto): 77.3%
    # 55+ (Idoso): 11.3%
    age_rand = h % 1000
    if age_rand < 7:
        age_group = "Criança"
        age_range = "13-17"
    elif age_rand < 110:
        age_group = "Jovem"
        age_range = "18-24"
    elif age_rand < 883:
        age_group = "Adulto"
        age_range = "25-54"
    else:
        age_group = "Idoso"
        age_range = "55+"
        
    # 3. Infer City
    # Almenara: 25.6%, Belo Horizonte: 4.8%, Araçuaí: 3.5%, Rubim: 3.2%, Jacinto: 2.5%, Outras: Rest
    city_rand = h % 1000
    if city_rand < 256:
        city = "Almenara"
    elif city_rand < 304:
        city = "Belo Horizonte"
    elif city_rand < 339:
        city = "Araçuaí"
    elif city_rand < 371:
        city = "Rubim"
    elif city_rand < 396:
        city = "Jacinto"
    else:
        city = "Outras"
        
    return gender, age_group, age_range, city

# Obter lista de seguidores reais para o broadcast
@app.route('/api/followers')
def get_followers():
    followers_path = os.path.join(EXPORT_DIR, 'connections', 'followers_and_following', 'followers_1.json')
    following_path = os.path.join(EXPORT_DIR, 'connections', 'followers_and_following', 'following.json')
    
    followers_list = []
    following_list = []
    
    if os.path.exists(followers_path):
        try:
            with open(followers_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for item in data:
                    string_data = item.get('string_list_data', [])
                    if string_data:
                        val = string_data[0].get('value', '')
                        ts = string_data[0].get('timestamp', 0)
                        if val:
                            username_decoded = decode_instagram_str(val)
                            gender, age_group, age_range, city = infer_demographics(username_decoded)
                            followers_list.append({
                                "username": username_decoded,
                                "timestamp": ts,
                                "followed_back": False,
                                "gender": gender,
                                "age_group": age_group,
                                "age_range": age_range,
                                "city": city
                            })
        except Exception as e:
            print(f"Erro ao ler seguidores: {e}")
            
    if os.path.exists(following_path):
        try:
            with open(following_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                relationships = data.get('relationships_following', [])
                for item in relationships:
                    string_data = item.get('string_list_data', [])
                    title = item.get('title', '')
                    if not title and string_data:
                        href = string_data[0].get('href', '')
                        if href:
                            title = href.split('/')[-1]
                    ts = string_data[0].get('timestamp', 0) if string_data else 0
                    if title:
                        following_list.append({
                            "username": decode_instagram_str(title),
                            "timestamp": ts
                        })
        except Exception as e:
            print(f"Erro ao ler seguidos: {e}")
            
    following_set = {f['username'] for f in following_list}
    for f in followers_list:
        if f['username'] in following_set:
            f['followed_back'] = True
            
    # Ordena seguidores em ordem alfabética
    followers_list.sort(key=lambda x: x['username'].lower())
    
    return jsonify({
        "followers": followers_list,
        "following": following_list,
        "total_followers": len(followers_list),
        "total_following": len(following_list)
    })

# Lista de conversas reais do direct
@app.route('/api/chats')
def get_chats():
    inbox_dir = os.path.join(EXPORT_DIR, 'your_instagram_activity', 'messages', 'inbox')
    if not os.path.exists(inbox_dir):
        return jsonify([])
        
    chats = []
    try:
        folders = os.listdir(inbox_dir)
        for folder in folders:
            folder_path = os.path.join(inbox_dir, folder)
            if not os.path.isdir(folder_path):
                continue
                
            message_file = os.path.join(folder_path, 'message_1.json')
            if os.path.exists(message_file):
                with open(message_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                title = decode_instagram_str(data.get('title', folder))
                participants = [decode_instagram_str(p['name']) for p in data.get('participants', [])]
                messages = data.get('messages', [])
                
                last_msg = ""
                last_msg_time = ""
                last_timestamp_ms = 0
                
                if messages:
                    m = messages[0]
                    last_msg = decode_instagram_str(m.get('content', ''))
                    if not last_msg and 'share' in m:
                        last_msg = "Compartilhamento de publicação/story"
                    elif not last_msg:
                        last_msg = "Mensagem de mídia"
                        
                    last_timestamp_ms = m.get('timestamp_ms', 0)
                    last_msg_time = time.strftime('%d/%m/%Y %H:%M', time.localtime(last_timestamp_ms / 1000.0))
                    
                # Gerar ID do chat a partir do nome da pasta
                chats.append({
                    "id": folder,
                    "sender": title,
                    "avatar": f"https://api.dicebear.com/7.x/initials/svg?seed={title}",
                    "lastMessage": last_msg,
                    "time": last_msg_time,
                    "timestamp_ms": last_timestamp_ms,
                    "unread": False,
                    "participants": participants
                })
                
        # Ordenar pelos mais recentes
        chats.sort(key=lambda x: x['timestamp_ms'], reverse=True)
        return jsonify(chats[:100])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Histórico do chat
@app.route('/api/chat/<folder>')
def get_chat_messages(folder):
    inbox_dir = os.path.join(EXPORT_DIR, 'your_instagram_activity', 'messages', 'inbox')
    message_file = os.path.join(inbox_dir, folder, 'message_1.json')
    
    if not os.path.exists(message_file):
        # Fallback: se não achar a pasta exata (ex: 'username'), procura por 'username_123456'
        found_file = None
        if os.path.exists(inbox_dir):
            try:
                for f in os.listdir(inbox_dir):
                    if f.split('_')[0] == folder or f == folder:
                        potential_file = os.path.join(inbox_dir, f, 'message_1.json')
                        if os.path.exists(potential_file):
                            found_file = potential_file
                            break
            except Exception as e:
                print(f"Erro ao buscar pasta alternativa: {e}")
        
        if found_file:
            message_file = found_file
        else:
            return jsonify({"error": "Chat não encontrado"}), 404
        
    try:
        with open(message_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        title = decode_instagram_str(data.get('title', folder))
        participants = [decode_instagram_str(p['name']) for p in data.get('participants', [])]
        raw_messages = data.get('messages', [])
        
        messages = []
        for m in reversed(raw_messages):
            sender = decode_instagram_str(m.get('sender_name', ''))
            content = decode_instagram_str(m.get('content', ''))
            
            if not content and 'share' in m:
                share = m['share']
                content = share.get('share_text', '') or share.get('link', '') or "Enviou um compartilhamento"
            elif not content:
                content = "[Mídia / Link]"
                
            timestamp_ms = m.get('timestamp_ms', 0)
            time_str = time.strftime('%H:%M', time.localtime(timestamp_ms / 1000.0))
            date_str = time.strftime('%d/%m/%Y', time.localtime(timestamp_ms / 1000.0))
            
            messages.append({
                "sender": sender,
                "content": content,
                "time": time_str,
                "date": date_str,
                "timestamp_ms": timestamp_ms
            })
            
        return jsonify({
            "title": title,
            "participants": participants,
            "messages": messages
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Execução do robô em thread
def run_bot_thread(accounts, message_template, leads, min_delay, max_delay, rotate_every=1):
    global bot_instance, bot_status, bot_progress, bot_logs
    
    bot_logs.clear()
    bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Iniciando robô de automação...")
    bot_status = "running"
    bot_progress = {"current": 0, "total": len(leads), "current_user": ""}
    
    try:
        bot_instance = InstagramBot(log_callback=lambda msg: bot_logs.append(f"[{time.strftime('%H:%M:%S')}] {msg}"))
        bot_instance.stop_flag = False
        
        current_account_index = 0
        messages_sent_by_current_account = 0
        logged_in_username = None
        
        for i, lead in enumerate(leads):
            if bot_instance.stop_flag:
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Automação interrompida pelo usuário.")
                break
                
            lead_username = lead.strip().replace("@", "")
            if not lead_username:
                continue
                
            # Determina se precisa rotacionar ou logar
            need_switch = False
            if logged_in_username is None:
                need_switch = True
            elif messages_sent_by_current_account >= rotate_every:
                need_switch = True
                
            if need_switch:
                if not accounts:
                    bot_status = "error"
                    bot_logs.append(f"[{time.strftime('%H:%M:%S')}] ERRO: Nenhuma conta válida configurada.")
                    return
                
                # Se já estiver logado em alguma, avisa que vai trocar
                if logged_in_username is not None:
                    bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Limite de envios de @{logged_in_username} atingido ({rotate_every} envios). Alternando conta...")
                    current_account_index = (current_account_index + 1) % len(accounts)
                
                acc = accounts[current_account_index]
                username = acc['username'].strip().replace("@", "")
                password = acc['password']
                
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Conectando ao Instagram com @{username}...")
                
                # Cria um cliente novo do instagrapi para evitar conflitos de sessão
                from instagrapi import Client
                bot_instance.client = Client()
                bot_instance.client.delay_range = [2, 5]
                
                if not bot_instance.login(username, password):
                    bot_logs.append(f"[{time.strftime('%H:%M:%S')}] AVISO: Falha de login na conta @{username}. Tentando próxima conta na fila...")
                    if len(accounts) > 1:
                        current_account_index = (current_account_index + 1) % len(accounts)
                        time.sleep(5)
                        # Tenta processar o mesmo lead novamente, mas com a próxima conta
                        continue
                    else:
                        bot_status = "error"
                        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] ERRO: A conta @{username} falhou no login e não há outras contas para rotacionar.")
                        return
                
                logged_in_username = username
                messages_sent_by_current_account = 0
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Conectado com sucesso como @{username}!")
            
            # Envio da mensagem
            bot_progress["current"] = i + 1
            bot_progress["current_user"] = lead_username
            bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Enviando mensagem para @{lead_username} usando a conta @{logged_in_username}...")
            
            try:
                # Obter ID do usuário
                user_id = bot_instance.client.user_id_from_username(lead_username)
                bot_instance.client.direct_send(message_template, [int(user_id)])
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] SUCESSO: Mensagem enviada para @{lead_username} por @{logged_in_username}")
                messages_sent_by_current_account += 1
                
                # Delay randômico
                delay = random.randint(min_delay, max_delay)
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Aguardando {delay} segundos antes do próximo envio...")
                for _ in range(delay):
                    if bot_instance.stop_flag:
                        break
                    time.sleep(1)
            except Exception as e:
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] ERRO ao enviar para @{lead_username} usando @{logged_in_username}: {e}")
                # Se der erro de bloco/limite na conta, força rotação no próximo envio
                messages_sent_by_current_account = rotate_every
                time.sleep(5)
                
        if not bot_instance.stop_flag:
            bot_status = "completed"
            bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Processamento concluído com sucesso!")
        else:
            bot_status = "idle"
            
    except Exception as e:
        bot_status = "error"
        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] ERRO FATAL: {e}")

# Iniciar disparo
@app.route('/api/bot/start', methods=['POST'])
def bot_start():
    global bot_thread, bot_status
    if bot_status == "running":
        return jsonify({"error": "O robô já está em execução"}), 400
        
    data = request.json or {}
    message = data.get('message')
    leads = data.get('leads', [])
    min_delay = int(data.get('min_delay', 60))
    max_delay = int(data.get('max_delay', 120))
    
    # Obter lista de contas ou única conta
    accounts = data.get('accounts', [])
    rotate_every = int(data.get('rotate_every', 1))
    
    if not accounts:
        # Fallback para conta única
        username = data.get('username')
        password = data.get('password')
        if username and password:
            accounts = [{"username": username, "password": password}]
            
    # Resolve as senhas se elas não foram enviadas pela rede
    resolved_accounts = []
    saved_accounts = load_saved_accounts()
    for acc in accounts:
        acc_username = acc.get('username', '').strip().replace("@", "")
        acc_password = acc.get('password', '')
        
        # Se não enviou a senha, tenta pegar do arquivo local
        if not acc_password:
            acc_password = saved_accounts.get(acc_username, '')
            
        if acc_username and acc_password:
            resolved_accounts.append({"username": acc_username, "password": acc_password})
            
            # Se enviou senha nova que não estava no arquivo local, salva
            if acc_username not in saved_accounts or saved_accounts[acc_username] != acc_password:
                saved_accounts[acc_username] = acc_password
                save_accounts(saved_accounts)

    if not resolved_accounts or not message or not leads:
        return jsonify({"error": "Preencha as contas de disparo (com senhas enviadas ou salvas no PC), mensagem e passe pelo menos um lead."}), 400
        
    bot_thread = threading.Thread(
        target=run_bot_thread, 
        args=(resolved_accounts, message, leads, min_delay, max_delay, rotate_every)
    )
    bot_thread.daemon = True
    bot_thread.start()
    
    return jsonify({"status": "started"})

# Parar disparo
@app.route('/api/bot/stop', methods=['POST'])
def bot_stop():
    global bot_instance, bot_status
    if bot_status == "running" and bot_instance:
        bot_instance.stop()
        bot_status = "stopping"
        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Solicitando interrupção. Aguarde...")
        return jsonify({"status": "stopping"})
    return jsonify({"error": "O robô não está em execução"}), 400

# Status do disparo
@app.route('/api/bot/status')
def bot_status_route():
    global bot_status, bot_logs, bot_progress
    return jsonify({
        "status": bot_status,
        "progress": bot_progress,
        "logs": bot_logs
    })

# Rota pública de Health Check
@app.route('/api/health')
def health():
    return jsonify({"status": "ok", "requires_auth": True})

def get_ngrok_url():
    try:
        import urllib.request
        import json
        req = urllib.request.Request('http://127.0.0.1:4040/api/tunnels')
        with urllib.request.urlopen(req, timeout=1) as response:
            data = json.loads(response.read().decode())
            tunnels = data.get('tunnels', [])
            for tunnel in tunnels:
                public_url = tunnel.get('public_url', '')
                if public_url.startswith('https:'):
                    return public_url
            if tunnels:
                return tunnels[0].get('public_url')
    except Exception:
        pass
    return None

def get_local_ip():
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

# Informações de Pareamento de Conexão (Somente para chamadas locais do PC)
@app.route('/api/connection-info')
def connection_info():
    ngrok_url = get_ngrok_url()
    local_ip = get_local_ip()
    return jsonify({
        "api_token": SERVER_TOKEN,
        "ngrok_url": ngrok_url,
        "local_url": f"http://{local_ip}:5000"
    })

if __name__ == '__main__':
    # Banner visual de inicialização
    print("\n" + "="*70)
    print("        INICIANDO SERVIDOR DE AUTOMAÇÃO (THENPERSON 2026)")
    print("="*70)
    print(" Endereço Local: http://localhost:5000")
    print(" Para acesso externo no Celular/Tablet, execute o ngrok:")
    print("   ngrok http 5000")
    print("")
    print(f" 🔑 CHAVE DE PAREAMENTO (API TOKEN): {SERVER_TOKEN}")
    print("="*70 + "\n")
    
    # Tenta obter a URL do ngrok para pareamento
    ngrok_url = get_ngrok_url()
    local_ip = get_local_ip()
    target_url = ngrok_url if ngrok_url else f"http://{local_ip}:5000"
    
    # Constrói o link de pareamento automático para o celular
    vercel_app_url = os.environ.get("VERCEL_APP_URL", "https://sdgtec.com.br")
    pairing_link = f"{vercel_app_url}/broadcast?api_url={target_url}&api_token={SERVER_TOKEN}"
    
    if not ngrok_url:
        print(" ⚠️  Aviso: Ngrok nao detectado. Usando IP da rede local Wi-Fi.")
        print(f"     Certifique-se de que o Celular e o PC estao na MESMA rede Wi-Fi.")
    else:
        print(" 🌐 SUCESSO: Ngrok detectado! Sincronizacao online ativa.")
    print("")
    
    print("📱 LINK DE PAREAMENTO AUTOMATICO:")
    print(pairing_link)
    
    try:
        import qrcode
        qr = qrcode.QRCode(version=1, box_size=1, border=1)
        qr.add_data(pairing_link)
        qr.make(fit=True)
        print("\n[+] ESCANEIE O QR CODE ABAIXO COM A CAMERA DO CELULAR PARA PAREAR INSTANTANEAMENTE:")
        qr.print_ascii()
        print("")
    except Exception as e:
        print(f"\n[-] Nao foi possivel exibir o QR Code no terminal: {e}")
        print("    Abra a camera do celular e acesse o link de pareamento acima ou insira manualmente no site.")
        
    app.run(host='0.0.0.0', port=5000, debug=True)
