import os
import sys
import json
import time
import random
import threading
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

# Adiciona o diretório da ferramenta de disparo ao path
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'GUI_ADD', 'Ferramenta de disparo'))
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

# Diretorios
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXPORT_DIR = os.path.join(BASE_DIR, 'GUI_ADD', 'instagram-thenperson-2026-06-03-qLooPzkL')

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
                            followers_list.append({
                                "username": decode_instagram_str(val),
                                "timestamp": ts,
                                "followed_back": False
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
def run_bot_thread(username, password, message_template, leads, min_delay, max_delay):
    global bot_instance, bot_status, bot_progress, bot_logs
    
    bot_logs.clear()
    bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Iniciando robô de automação...")
    bot_status = "running"
    bot_progress = {"current": 0, "total": len(leads), "current_user": ""}
    
    try:
        bot_instance = InstagramBot(log_callback=lambda msg: bot_logs.append(f"[{time.strftime('%H:%M:%S')}] {msg}"))
        
        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Conectando ao Instagram...")
        if not bot_instance.login(username, password):
            bot_status = "error"
            bot_logs.append(f"[{time.strftime('%H:%M:%S')}] ERRO: Falha ao realizar login. Verifique seu usuário e senha.")
            return
            
        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Login bem-sucedido! Iniciando disparos...")
        
        bot_instance.stop_flag = False
        for i, lead in enumerate(leads):
            if bot_instance.stop_flag:
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Automação interrompida pelo usuário.")
                break
                
            lead_username = lead.strip().replace("@", "")
            if not lead_username:
                continue
                
            bot_progress["current"] = i + 1
            bot_progress["current_user"] = lead_username
            bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Enviar para @{lead_username} ({i+1}/{len(leads)})...")
            
            try:
                # Obter ID do usuário
                user_id = bot_instance.client.user_id_from_username(lead_username)
                bot_instance.client.direct_send(message_template, [int(user_id)])
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] SUCESSO: Mensagem enviada para @{lead_username}")
                
                # Delay randômico
                delay = random.randint(min_delay, max_delay)
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Aguardando {delay} segundos antes do próximo envio...")
                for _ in range(delay):
                    if bot_instance.stop_flag:
                        break
                    time.sleep(1)
            except Exception as e:
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] ERRO ao enviar para @{lead_username}: {e}")
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
    username = data.get('username')
    password = data.get('password')
    message = data.get('message')
    leads = data.get('leads', [])
    min_delay = int(data.get('min_delay', 60))
    max_delay = int(data.get('max_delay', 120))
    
    if not username or not password or not message or not leads:
        return jsonify({"error": "Preencha usuário, senha, mensagem e passe pelo menos um lead."}), 400
        
    bot_thread = threading.Thread(
        target=run_bot_thread, 
        args=(username, password, message, leads, min_delay, max_delay)
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
