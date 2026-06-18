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
creator_process = None

ACCOUNTS_FILE = os.path.join(BASE_DIR, 'accounts.json')
LIVE_CACHE_FILE = os.path.join(BASE_DIR, 'live_cache.json')
SETTINGS_FILE = os.path.join(BASE_DIR, 'settings.json')

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

# Obter lista completa de contas (com senhas)
@app.route('/api/accounts/full', methods=['GET'])
def get_saved_accounts_full():
    accounts_dict = load_saved_accounts()
    return jsonify([{"username": username, "password": password} for username, password in accounts_dict.items()])

# Exportar contas formatadas em arquivo TXT (usuario:senha)
@app.route('/api/accounts/export', methods=['GET'])
def export_accounts_txt():
    accounts_dict = load_saved_accounts()
    content = ""
    for username, password in accounts_dict.items():
        content += f"{username}:{password}\n"
    from flask import Response
    return Response(
        content,
        mimetype="text/plain",
        headers={"Content-disposition": "attachment; filename=contas_geradas.txt"}
    )

# Exportar contas em arquivo JSON
@app.route('/api/accounts/export-json', methods=['GET'])
def export_accounts_json():
    from flask import send_file
    if os.path.exists(ACCOUNTS_FILE):
        return send_file(ACCOUNTS_FILE, as_attachment=True, download_name="contas_geradas.json")
    else:
        return jsonify({"error": "Nenhuma conta gerada ainda"}), 404

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
    if os.path.exists(LIVE_CACHE_FILE):
        try:
            with open(LIVE_CACHE_FILE, 'r', encoding='utf-8') as f:
                cache = json.load(f)
                prof = cache.get("profile", {})
                followers = cache.get("followers", [])
                
                # Calcula cidades a partir dos seguidores reais
                cities_dict = {}
                for f_item in followers:
                    city = f_item.get("city", "Outras")
                    cities_dict[city] = cities_dict.get(city, 0) + 1
                
                cities_data = []
                total_f = len(followers) or 1
                for c_name, c_cnt in cities_dict.items():
                    cities_data.append({"name": c_name, "value": round((c_cnt / total_f) * 100, 1)})
                cities_data.sort(key=lambda x: x["value"], reverse=True)
                
                # Calcula faixas etárias
                age_dict = {}
                for f_item in followers:
                    age = f_item.get("age_range", "25-54")
                    age_dict[age] = age_dict.get(age, 0) + 1
                age_groups = [{"age": k, "value": round((v / total_f) * 100, 1)} for k, v in age_dict.items()]
                
                # Calcula gênero
                gen_dict = {"Homens": 0, "Mulheres": 0}
                for f_item in followers:
                    gen = f_item.get("gender", "Mulheres")
                    if gen in gen_dict:
                        gen_dict[gen] += 1
                gender_data = [{"name": k, "value": round((v / total_f) * 100, 1)} for k, v in gen_dict.items()]
                
                return jsonify({
                    "metrics": [
                        {"label": "Total Seguidores", "value": f"{prof.get('follower_count', 0):,}".replace(',', '.'), "change": 0.0},
                        {"label": "Publicações", "value": str(prof.get('media_count', 0)), "change": 0.0},
                        {"label": "Seguindo", "value": str(prof.get('following_count', 0)), "change": 0.0},
                        {"label": "Leads Sincronizados", "value": str(len(followers)), "change": 100.0}
                    ],
                    "audience": {
                        "cities": cities_data[:5],
                        "age_groups": age_groups,
                        "gender": gender_data,
                        "weekday_activity": [
                            {"day": "Segunda", "value": 12700},
                            {"day": "Terça", "value": 12700},
                            {"day": "Quarta", "value": 12800},
                            {"day": "Quinta", "value": 12800},
                            {"day": "Sexta", "value": 12700},
                            {"day": "Sábado", "value": 12700},
                            {"day": "Domingo", "value": 12800}
                        ]
                    }
                })
        except Exception as e:
            print(f"Erro ao processar stats do cache: {e}")

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
    if os.path.exists(LIVE_CACHE_FILE):
        try:
            with open(LIVE_CACHE_FILE, 'r', encoding='utf-8') as f:
                cache = json.load(f)
                return jsonify(cache.get("posts", []))
        except Exception as e:
            print(f"Erro ao ler posts do cache: {e}")

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

def get_audio_for_lead(audio_config, username):
    if not audio_config:
        return None
    if isinstance(audio_config, str):
        return audio_config if os.path.exists(audio_config) else None
        
    if isinstance(audio_config, dict):
        # Infer demographics
        gender, age_group, age_range, city = infer_demographics(username)
        
        # Priority 1: Age group (Jovem, Adulto, etc.)
        if age_group in audio_config and audio_config[age_group]:
            path = audio_config[age_group]
            if os.path.exists(path):
                return path
        # Priority 2: Gender (Homens, Mulheres)
        if gender in audio_config and audio_config[gender]:
            path = audio_config[gender]
            if os.path.exists(path):
                return path
        # Priority 3: Default (fallback)
        if 'default' in audio_config and audio_config['default']:
            path = audio_config['default']
            if os.path.exists(path):
                return path
                
    return None

def infer_demographics(username):
    # Deterministic hash to distribute attributes consistently
    h = sum(ord(c) for c in username)
    
    # 1. Infer Gender
    # Check common female endings or indicators
    female_indicators = ['aline', 'ana', 'beatriz', 'barbara', 'carla', 'clara', 'durvalina', 'gabriela', 'julia', 'lara', 'leticia', 'luana', 'maria', 'mariana', 'patricia', 'sara', 'silvia', 'tatiane', 'vanessa', 'vitoria', 'ella', 'ina', 'ria', 'nda', 'isa', 'cia', 'ssa', 'ta', 'a']
    male_indicators = ['adelson', 'alex', 'carlos', 'daniel', 'douglas', 'eduardo', 'felipe', 'gabriel', 'gustavo', 'joao', 'lucas', 'mateus', 'pedro', 'rafael', 'rodrigo', 'tiago', 'vitor', 'one', 'son', 'ton', 'ald', 'er', 'os', 'go', 'o']
    
    # Explicit list of common Portuguese names to avoid false matches on surnames (e.g. Alcântara, Silva, Sousa)
    male_names = [
        'guilherme', 'tiago', 'thiago', 'rodrigo', 'felipe', 'fellype', 'lucas', 'mateus', 'matheus',
        'pedro', 'rafael', 'vitor', 'victor', 'gabriel', 'gustavo', 'joao', 'carlos', 'daniel',
        'douglas', 'eduardo', 'bruno', 'marcos', 'andre', 'luiz', 'luis', 'henrique', 'diego',
        'arthur', 'artur', 'marcelo', 'alexandre', 'otavio', 'leonardo', 'igor', 'ricardo',
        'renan', 'caio', 'samuel', 'allan', 'alan', 'willian', 'william', 'wellington', 'wesley',
        'hugo', 'murilo', 'vinicius', 'ramon', 'roberto', 'paulo', 'fernando', 'fabricio',
        'marcio', 'cleber', 'robson', 'valter', 'mauricio', 'alex', 'leandro', 'alberto',
        'adriano', 'rogerio', 'claudio', 'renato', 'fabio', 'jefferson', 'george',
        'nilton', 'newton', 'hamilton', 'milton', 'adelson', 'elton', 'everton', 'cleiton',
        'wagner', 'valdir', 'anderson', 'alessandro'
    ]
    female_names = [
        'aline', 'ana', 'beatriz', 'barbara', 'carla', 'clara', 'gabriela', 'julia', 'lara',
        'leticia', 'luana', 'maria', 'mariana', 'patricia', 'sara', 'silvia', 'tatiane',
        'vanessa', 'vitoria', 'amanda', 'bruna', 'camila', 'carolina', 'fernanda', 'isabela',
        'juliana', 'larissa', 'luiza', 'nathalia', 'natalia', 'paula', 'rafaela', 'renata',
        'thais', 'tais', 'bianca', 'debora', 'daniela', 'elaine', 'gisele', 'giovanna',
        'heloisa', 'isabel', 'jaqueline', 'karina', 'kelly', 'marcela', 'monica', 'nayara',
        'priscila', 'sabrina', 'talita', 'tatiana', 'valeria', 'viviane', 'adriana', 'claudia',
        'fabiana', 'andreia', 'andressa', 'cristiane', 'regiane', 'simone', 'solange', 'rosana',
        'marcia', 'luciana', 'deborah', 'michele', 'michelle', 'caroline', 'karoline', 'alessandra'
    ]
    
    username_lower = username.lower()
    
    is_female = False
    is_male = False
    
    # Check if starts with a known male or female name (most common for first name)
    for name in male_names:
        if username_lower.startswith(name):
            is_male = True
            break
            
    if not is_male:
        for name in female_names:
            if username_lower.startswith(name):
                is_female = True
                break
                
    # If not matched by start, check if it contains/ends with name with separators or at the end
    if not is_male and not is_female:
        for name in male_names:
            if username_lower.endswith(name) or f"_{name}" in username_lower or f".{name}" in username_lower:
                is_male = True
                break
                
    if not is_male and not is_female:
        for name in female_names:
            if username_lower.endswith(name) or f"_{name}" in username_lower or f".{name}" in username_lower:
                is_female = True
                break
                
    # Fallback to general suffix indicators
    if not is_male and not is_female:
        for indicator in female_indicators:
            if username_lower.endswith(indicator) or f"_{indicator}" in username_lower or f".{indicator}" in username_lower:
                is_female = True
                break
                
    if not is_male and not is_female:
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
    if os.path.exists(LIVE_CACHE_FILE):
        try:
            with open(LIVE_CACHE_FILE, 'r', encoding='utf-8') as f:
                cache = json.load(f)
                followers = cache.get("followers", [])
                followers.sort(key=lambda x: x['username'].lower())
                return jsonify({
                    "followers": followers,
                    "following": [],
                    "total_followers": len(followers),
                    "total_following": 0
                })
        except Exception as e:
            print(f"Erro ao ler seguidores do cache: {e}")

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
    if os.path.exists(LIVE_CACHE_FILE):
        try:
            with open(LIVE_CACHE_FILE, 'r', encoding='utf-8') as f:
                cache = json.load(f)
                chats = cache.get("chats", [])
                chats_summary = []
                for c in chats:
                    chats_summary.append({
                        "id": c.get("id"),
                        "sender": c.get("sender"),
                        "avatar": c.get("avatar"),
                        "lastMessage": c.get("lastMessage"),
                        "time": c.get("time"),
                        "timestamp_ms": c.get("timestamp_ms"),
                        "unread": c.get("unread"),
                        "participants": c.get("participants")
                    })
                return jsonify(chats_summary)
        except Exception as e:
            print(f"Erro ao ler chats do cache: {e}")

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
    if os.path.exists(LIVE_CACHE_FILE):
        try:
            with open(LIVE_CACHE_FILE, 'r', encoding='utf-8') as f:
                cache = json.load(f)
                chats = cache.get("chats", [])
                for chat in chats:
                    is_match = (chat.get("id") == folder or 
                                chat.get("sender").lower() == folder.lower() or 
                                folder.lower() in [p.lower() for p in chat.get("participants", [])])
                    if is_match:
                        return jsonify({
                            "title": chat.get("sender"),
                            "participants": chat.get("participants"),
                            "messages": chat.get("messages", [])
                        })
        except Exception as e:
            print(f"Erro ao ler chat do cache: {e}")

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

bot_instances = []
progress_lock = threading.Lock()
log_lock = threading.Lock()

def add_log(msg):
    with log_lock:
        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] {msg}")

def generate_gemini_message(api_key, username, prompt_instruction):
    try:
        import requests
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        headers = {'Content-Type': 'application/json'}
        
        system_prompt = (
            f"Você é um assistente de redes sociais amigável enviando uma mensagem direta (DM) no Instagram "
            f"para o usuário @{username}. A mensagem deve parecer natural, humana, sem parecer robótica "
            f"ou spam, e deve ser curta (máximo 150 caracteres para caber bem no direct). "
            f"Gere a mensagem baseando-se estritamente nesta instrução: {prompt_instruction}"
        )
        
        payload = {
            "contents": [{
                "parts": [{"text": system_prompt}]
            }]
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=15)
        if response.status_code == 200:
            res_data = response.json()
            parts = res_data.get('candidates', [{}])[0].get('content', {}).get('parts', [])
            if parts:
                text = parts[0].get('text', '').strip()
                if text.startswith('"') and text.endswith('"'):
                    text = text[1:-1]
                return text
        return f"Erro na chamada do Gemini API (Status {response.status_code})"
    except Exception as e:
        return f"Erro ao gerar texto com Gemini: {e}"

def run_account_thread(account, message_template, account_leads, min_delay, max_delay, thread_id, action='message', gemini_api_key=None, gemini_prompt=None, audio_path=None):
    global bot_status, bot_progress, bot_instances
    username = account['username'].strip().replace("@", "")
    password = account['password']
    
    add_log(f"[@{username}] Iniciando thread #{thread_id} para {len(account_leads)} leads...")
    
    bot = InstagramBot(log_callback=lambda msg: add_log(f"[@{username}] {msg}"))
    with progress_lock:
        bot_instances.append(bot)
        
    try:
        from instagrapi import Client
        bot.client = Client()
        bot.client.delay_range = [2, 5]
        
        # Suporta proxy
        proxy = os.environ.get("INSTAGRAM_PROXY")
        if proxy:
            bot.client.set_proxy(proxy)
            
        add_log(f"[@{username}] Conectando ao Instagram...")
        if not bot.login(username, password):
            add_log(f"[@{username}] ERRO: Falha no login da conta @{username}. Finalizando esta thread.")
            return
            
        add_log(f"[@{username}] Conectado com sucesso!")
        
        for idx, lead_username in enumerate(account_leads):
            if bot.stop_flag or bot_status == "stopping":
                add_log(f"[@{username}] Thread interrompida pelo usuário.")
                break
                
            lead_username = lead_username.strip().replace("@", "")
            if not lead_username:
                continue
                
            try:
                user_id = bot.client.user_id_from_username(lead_username)
                
                if action == 'follow' or action == 'both':
                    add_log(f"[@{username}] Seguindo @{lead_username}...")
                    bot.client.user_follow(int(user_id))
                    add_log(f"[@{username}] SUCESSO: Começou a seguir @{lead_username}")
                    
                if action == 'message' or action == 'both':
                    msg_to_send = message_template
                    if msg_to_send:
                        if gemini_api_key and gemini_prompt:
                            add_log(f"[@{username}] Gerando mensagem personalizada com IA para @{lead_username}...")
                            generated = generate_gemini_message(gemini_api_key, lead_username, gemini_prompt)
                            if "Erro" in generated:
                                add_log(f"[@{username}] [Gemini] {generated}. Usando mensagem padrão.")
                            else:
                                msg_to_send = generated
                                add_log(f"[@{username}] [Gemini] Mensagem gerada: \"{msg_to_send}\"")

                        add_log(f"[@{username}] Enviando mensagem para @{lead_username}...")
                        bot.client.direct_send(msg_to_send, [int(user_id)])
                        add_log(f"[@{username}] SUCESSO: Mensagem enviada para @{lead_username}")
                    
                    lead_audio = get_audio_for_lead(audio_path, lead_username)
                    if lead_audio:
                        add_log(f"[@{username}] Enviando áudio personalizado ({os.path.basename(lead_audio)}) para @{lead_username}...")
                        bot.client.direct_send_voice(path=lead_audio, user_ids=[int(user_id)])
                        add_log(f"[@{username}] SUCESSO: Áudio enviado para @{lead_username}")
                
                with progress_lock:
                    bot_progress["current"] += 1
                    
                # Delay randômico
                delay = random.randint(min_delay, max_delay)
                add_log(f"[@{username}] Aguardando {delay} segundos...")
                for _ in range(delay):
                    if bot.stop_flag or bot_status == "stopping":
                        break
                    time.sleep(1)
            except Exception as e:
                add_log(f"[@{username}] ERRO ao enviar para @{lead_username}: {e}")
                time.sleep(5)
                
    except Exception as e:
        add_log(f"[@{username}] ERRO CRÍTICO na thread: {e}")

def run_parallel_threads(accounts, message_template, leads, min_delay, max_delay, action='message', gemini_api_key=None, gemini_prompt=None, audio_path=None):
    global bot_status, bot_progress, bot_instances
    
    bot_logs.clear()
    bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Iniciando disparador no MODO PARALELO...")
    bot_status = "running"
    bot_progress = {"current": 0, "total": len(leads), "current_user": "Múltiplas Contas"}
    bot_instances.clear()
    
    num_accounts = len(accounts)
    leads_per_account = [[] for _ in range(num_accounts)]
    for idx, lead in enumerate(leads):
        leads_per_account[idx % num_accounts].append(lead)
        
    threads = []
    for i, acc in enumerate(accounts):
        account_leads = leads_per_account[i]
        if not account_leads:
            continue
            
        t = threading.Thread(
            target=run_account_thread,
            args=(acc, message_template, account_leads, min_delay, max_delay, i + 1, action, gemini_api_key, gemini_prompt, audio_path)
        )
        t.daemon = True
        threads.append(t)
        t.start()
        
    for t in threads:
        t.join()
        
    any_stopped = any(bot.stop_flag for bot in bot_instances)
    if any_stopped:
        bot_status = "idle"
        add_log("Disparador paralelo interrompido pelo usuário.")
    else:
        bot_status = "completed"
        add_log("Processamento paralelo concluído com sucesso!")

# Execução do robô em thread
def run_bot_thread(accounts, message_template, leads, min_delay, max_delay, rotate_every=1, action='message', gemini_api_key=None, gemini_prompt=None, audio_path=None):
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
            
            # Ação de Enviar / Seguir
            bot_progress["current"] = i + 1
            bot_progress["current_user"] = lead_username
            
            try:
                # Obter ID do usuário
                user_id = bot_instance.client.user_id_from_username(lead_username)
                
                if action == 'follow' or action == 'both':
                    bot_logs.append(f"[{time.strftime('%H:%M:%S')}] [@{logged_in_username}] Seguindo @{lead_username}...")
                    bot_instance.client.user_follow(int(user_id))
                    bot_logs.append(f"[{time.strftime('%H:%M:%S')}] SUCESSO: @{logged_in_username} começou a seguir @{lead_username}")
                    
                if action == 'message' or action == 'both':
                    msg_to_send = message_template
                    if msg_to_send:
                        if gemini_api_key and gemini_prompt:
                            bot_logs.append(f"[{time.strftime('%H:%M:%S')}] [@{logged_in_username}] Gerando mensagem personalizada com IA para @{lead_username}...")
                            generated = generate_gemini_message(gemini_api_key, lead_username, gemini_prompt)
                            if "Erro" in generated:
                                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] [Gemini] {generated}. Usando mensagem padrão.")
                            else:
                                msg_to_send = generated
                                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] [Gemini] Mensagem gerada: \"{msg_to_send}\"")

                        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] [@{logged_in_username}] Enviando mensagem para @{lead_username}...")
                        bot_instance.client.direct_send(msg_to_send, [int(user_id)])
                        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] SUCESSO: Mensagem enviada para @{lead_username}")
                    
                    lead_audio = get_audio_for_lead(audio_path, lead_username)
                    if lead_audio:
                        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] [@{logged_in_username}] Enviando áudio personalizado ({os.path.basename(lead_audio)}) para @{lead_username}...")
                        bot_instance.client.direct_send_voice(path=lead_audio, user_ids=[int(user_id)])
                        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] SUCESSO: Áudio enviado para @{lead_username}")
                
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

def run_post_action_thread(accounts, post_url, like, share, leads, min_delay, max_delay, rotate_every=1, gemini_api_key=None, gemini_prompt=None, comment=False, comment_text=""):
    global bot_instance, bot_status, bot_progress, bot_logs
    
    bot_logs.clear()
    bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Iniciando automação de postagem (Curtir/Compartilhar/Comentar)...")
    bot_status = "running"
    
    try:
        bot_instance = InstagramBot(log_callback=lambda msg: bot_logs.append(f"[{time.strftime('%H:%M:%S')}] {msg}"))
        bot_instance.stop_flag = False
        
        liked_accounts = set()
        media_id = None
        
        if not share and not comment:
            # Apenas curtir com todas as contas
            bot_progress = {"current": 0, "total": len(accounts), "current_user": ""}
            for idx, acc in enumerate(accounts):
                if bot_instance.stop_flag or bot_status == "stopping":
                    break
                username = acc['username'].strip().replace("@", "")
                password = acc['password']
                bot_progress["current"] = idx + 1
                bot_progress["current_user"] = username
                
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] [@{username}] Conectando para curtir o post...")
                from instagrapi import Client
                bot_instance.client = Client()
                bot_instance.client.delay_range = [2, 5]
                
                # Suporta proxy
                proxy = os.environ.get("INSTAGRAM_PROXY")
                if proxy:
                    bot_instance.client.set_proxy(proxy)
                    
                if bot_instance.login(username, password):
                    try:
                        if not media_id:
                            media_pk = bot_instance.client.media_pk_from_url(post_url)
                            media_id = bot_instance.client.media_id(media_pk)
                        
                        bot_instance.client.media_like(media_id)
                        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] SUCESSO: @{username} curtiu o post.")
                    except Exception as ex:
                        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] ERRO ao curtir com @{username}: {ex}")
                else:
                    bot_logs.append(f"[{time.strftime('%H:%M:%S')}] ERRO: Falha de login para @{username}.")
                
                if idx < len(accounts) - 1:
                    delay = random.randint(min_delay, max_delay)
                    bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Aguardando {delay} segundos...")
                    for _ in range(delay):
                        if bot_instance.stop_flag or bot_status == "stopping":
                            break
                        time.sleep(1)
        else:
            # Curtir, Compartilhar e/ou Comentar com leads
            bot_progress = {"current": 0, "total": len(leads), "current_user": ""}
            current_account_index = 0
            shares_sent_by_current_account = 0
            logged_in_username = None
            
            for i, lead in enumerate(leads):
                if bot_instance.stop_flag or bot_status == "stopping":
                    break
                lead_username = lead.strip().replace("@", "")
                if not lead_username:
                    continue
                    
                need_switch = False
                if logged_in_username is None:
                    need_switch = True
                elif shares_sent_by_current_account >= rotate_every:
                    need_switch = True
                    
                if need_switch:
                    if not accounts:
                        bot_status = "error"
                        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] ERRO: Nenhuma conta cadastrada.")
                        return
                        
                    if logged_in_username is not None:
                        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Limite de envios de @{logged_in_username} atingido. Alternando conta...")
                        current_account_index = (current_account_index + 1) % len(accounts)
                        
                    acc = accounts[current_account_index]
                    username = acc['username'].strip().replace("@", "")
                    password = acc['password']
                    
                    bot_logs.append(f"[{time.strftime('%H:%M:%S')}] [@{username}] Conectando ao Instagram...")
                    from instagrapi import Client
                    bot_instance.client = Client()
                    bot_instance.client.delay_range = [2, 5]
                    
                    # Suporta proxy
                    proxy = os.environ.get("INSTAGRAM_PROXY")
                    if proxy:
                        bot_instance.client.set_proxy(proxy)
                        
                    if not bot_instance.login(username, password):
                        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] ERRO: Falha no login da conta @{username}. Tentando próxima...")
                        if len(accounts) > 1:
                            current_account_index = (current_account_index + 1) % len(accounts)
                            time.sleep(5)
                            # Reprocessa o mesmo lead
                            continue
                        else:
                            bot_status = "error"
                            return
                            
                    logged_in_username = username
                    shares_sent_by_current_account = 0
                    bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Conectado com sucesso como @{username}!")
                    
                # Se precisar curtir o post e ainda não curtiu com esta conta
                if like and logged_in_username not in liked_accounts:
                    try:
                        if not media_id:
                            media_pk = bot_instance.client.media_pk_from_url(post_url)
                            media_id = bot_instance.client.media_id(media_pk)
                        bot_instance.client.media_like(media_id)
                        liked_accounts.add(logged_in_username)
                        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] SUCESSO: @{logged_in_username} curtiu o post.")
                    except Exception as ex:
                        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] ERRO ao curtir com @{logged_in_username}: {ex}")
                        
                # Ação (Compartilhar e/ou Comentar) com o lead
                bot_progress["current"] = i + 1
                bot_progress["current_user"] = lead_username
                
                try:
                    if not media_id:
                        media_pk = bot_instance.client.media_pk_from_url(post_url)
                        media_id = bot_instance.client.media_id(media_pk)
                    
                    action_done = False
                    
                    if share:
                        user_id = bot_instance.client.user_id_from_username(lead_username)
                        text_to_send = ""
                        if gemini_api_key and gemini_prompt:
                            bot_logs.append(f"[{time.strftime('%H:%M:%S')}] [@{logged_in_username}] Gerando comentário personalizado com IA para @{lead_username}...")
                            generated = generate_gemini_message(gemini_api_key, lead_username, gemini_prompt)
                            if "Erro" not in generated:
                                text_to_send = generated
                                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] [Gemini] Comentário gerado: \"{text_to_send}\"")
                                
                        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] [@{logged_in_username}] Compartilhando post com @{lead_username}...")
                        bot_instance.client.direct_media_share(media_id, [int(user_id)])
                        if text_to_send:
                            bot_instance.client.direct_send(text_to_send, [int(user_id)])
                        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] SUCESSO: Post compartilhado com @{lead_username}")
                        action_done = True
                        
                    if comment:
                        # Comentar no post marcando o lead
                        comment_to_send = f"{comment_text} @{lead_username}" if comment_text else f"@{lead_username}"
                        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] [@{logged_in_username}] Comentando no post: \"{comment_to_send}\"")
                        bot_instance.client.media_comment(media_id, comment_to_send)
                        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] SUCESSO: Comentário realizado marcando @{lead_username}")
                        action_done = True
                        
                    if action_done:
                        shares_sent_by_current_account += 1
                        
                    delay = random.randint(min_delay, max_delay)
                    bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Aguardando {delay} segundos...")
                    for _ in range(delay):
                        if bot_instance.stop_flag or bot_status == "stopping":
                            break
                        time.sleep(1)
                except Exception as ex:
                    bot_logs.append(f"[{time.strftime('%H:%M:%S')}] ERRO ao processar @{lead_username} usando @{logged_in_username}: {ex}")
                    shares_sent_by_current_account = rotate_every
                    time.sleep(5)
                    
        if not bot_instance.stop_flag and bot_status != "stopping":
            bot_status = "completed"
            bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Automação de postagem concluída com sucesso!")
        else:
            bot_status = "idle"
            
    except Exception as e:
        bot_status = "error"
        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] ERRO geral na automação de postagem: {e}")

# Iniciar curtidas/compartilhamentos de post
@app.route('/api/bot/post-action', methods=['POST'])
def bot_post_action():
    global bot_thread, bot_status
    if bot_status == "running":
        return jsonify({"error": "O robô já está em execução"}), 400
        
    data = request.json or {}
    post_url = data.get('post_url')
    like = bool(data.get('like', False))
    share = bool(data.get('share', False))
    comment = bool(data.get('comment', False))
    comment_text = data.get('comment_text', '')
    leads = data.get('leads', [])
    min_delay = int(data.get('min_delay', 5))
    max_delay = int(data.get('max_delay', 15))
    rotate_every = int(data.get('rotate_every', 1))
    gemini_api_key = data.get('gemini_api_key')
    gemini_prompt = data.get('gemini_prompt')
    
    if not post_url:
        return jsonify({"error": "Forneça o link da publicação do Instagram."}), 400
        
    if not like and not share and not comment:
        return jsonify({"error": "Selecione pelo menos uma ação (Curtir, Compartilhar ou Comentar)."}), 400
        
    if (share or comment) and not leads:
        return jsonify({"error": "Forneça pelo menos um lead para compartilhar ou comentar no post."}), 400
        
    # Contas
    accounts = data.get('accounts', [])
    resolved_accounts = []
    saved_accounts = load_saved_accounts()
    for acc in accounts:
        acc_username = acc.get('username', '').strip().replace("@", "")
        acc_password = acc.get('password', '')
        if not acc_password:
            acc_password = saved_accounts.get(acc_username, '')
        if acc_username and acc_password:
            resolved_accounts.append({"username": acc_username, "password": acc_password})
            
    if not resolved_accounts:
        return jsonify({"error": "Selecione ou cadastre pelo menos uma conta de disparo."}), 400
        
    bot_thread = threading.Thread(
        target=run_post_action_thread,
        args=(resolved_accounts, post_url, like, share, leads, min_delay, max_delay, rotate_every, gemini_api_key, gemini_prompt, comment, comment_text)
    )
    bot_thread.daemon = True
    bot_thread.start()
    
    return jsonify({"status": "started"})

# Rota para upload de áudio
@app.route('/api/upload-audio', methods=['POST'])
def upload_audio():
    if 'audio' not in request.files:
        return jsonify({"error": "Nenhum arquivo enviado"}), 400
    file = request.files['audio']
    if file.filename == '':
        return jsonify({"error": "Nome de arquivo vazio"}), 400
        
    # Salva na pasta 'uploads'
    uploads_dir = os.path.join(BASE_DIR, 'uploads')
    os.makedirs(uploads_dir, exist_ok=True)
    
    # Gera um nome seguro
    ext = os.path.splitext(file.filename)[1].lower()
    filename = f"audio_{int(time.time())}{ext}"
    file_path = os.path.join(uploads_dir, filename)
    file.save(file_path)
    
    # Se for MP3 ou WAV, tenta converter para M4A se o ffmpeg estiver disponível
    final_path = file_path
    if ext != '.m4a' and ext != '.aac':
        converted_filename = f"audio_{int(time.time())}.m4a"
        converted_path = os.path.join(uploads_dir, converted_filename)
        import subprocess
        try:
            # Tenta usar o ffmpeg para converter
            result = subprocess.run(
                ['ffmpeg', '-y', '-i', file_path, '-c:a', 'aac', '-b:a', '128k', converted_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            if result.returncode == 0 and os.path.exists(converted_path):
                final_path = converted_path
                try:
                    os.remove(file_path)
                except Exception:
                    pass
                filename = converted_filename
                ext = '.m4a'
            else:
                print(f"Falha na conversão ffmpeg: {result.stderr}")
        except Exception as e:
            print(f"FFmpeg não disponível ou erro na conversão: {e}")
            
    return jsonify({
        "status": "success",
        "filename": filename,
        "path": final_path.replace('\\', '/'),
        "format": ext
    })

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
    audio_path = data.get('audio_path')
    
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
 
    action = data.get('action', 'message')
    mode = data.get('mode', 'sequential')
    gemini_api_key = data.get('gemini_api_key')
    gemini_prompt = data.get('gemini_prompt')
 
    needs_content = (action != 'follow') and not (gemini_api_key and gemini_prompt) and not audio_path
    if not resolved_accounts or (needs_content and not message) or not leads:
        return jsonify({"error": "Preencha as contas de disparo, insira uma mensagem ou um áudio de disparo, e passe pelo menos um lead."}), 400
    
    if mode == 'parallel':
        bot_thread = threading.Thread(
            target=run_parallel_threads, 
            args=(resolved_accounts, message, leads, min_delay, max_delay, action, gemini_api_key, gemini_prompt, audio_path)
        )
    else:
        bot_thread = threading.Thread(
            target=run_bot_thread, 
            args=(resolved_accounts, message, leads, min_delay, max_delay, rotate_every, action, gemini_api_key, gemini_prompt, audio_path)
        )
    bot_thread.daemon = True
    bot_thread.start()
    
    return jsonify({"status": "started"})

# Parar disparo
@app.route('/api/bot/stop', methods=['POST'])
def bot_stop():
    global bot_instance, bot_status, bot_instances, creator_process
    if bot_status == "running" or bot_status == "stopping":
        bot_status = "stopping"
        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Solicitando interrupção de todas as threads...")
        if bot_instance:
            bot_instance.stop()
        for bot in bot_instances:
            bot.stop()
        if creator_process:
            try:
                creator_process.terminate()
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Processo de criação de contas encerrado.")
            except Exception as e:
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Erro ao encerrar criador: {e}")
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

# Verificar e autenticar conta do Instagram usando instagrapi
@app.route('/api/accounts/verify', methods=['POST'])
def verify_account():
    data = request.json or {}
    username = data.get('username', '').strip().replace("@", "")
    password = data.get('password', '')
    if not username or not password:
        return jsonify({"message": "Preencha usuário e senha"}), 400
        
    # Tenta autenticar usando instagrapi
    from instagrapi import Client
    cl = Client()
    cl.delay_range = [2, 5]
    proxy = os.environ.get("INSTAGRAM_PROXY")
    if proxy:
        cl.set_proxy(proxy)
        
    try:
        session_file = f"session_{username}.json"
        if os.path.exists(session_file):
            try:
                cl.load_settings(session_file)
                cl.login(username, password)
            except Exception:
                cl.login(username, password)
                cl.dump_settings(session_file)
        else:
            cl.login(username, password)
            cl.dump_settings(session_file)
            
        # Adiciona ou atualiza no accounts.json
        accounts_dict = load_saved_accounts()
        accounts_dict[username] = password
        save_accounts(accounts_dict)
        return jsonify({"status": "success", "message": f"Conta @{username} autenticada e salva com sucesso!"})
    except Exception as e:
        return jsonify({"message": f"Erro de autenticação para @{username}: {str(e)}"}), 400

# Rota para publicar foto em lote para ter conteúdo nas contas
@app.route('/api/accounts/post-media', methods=['POST'])
def post_media():
    if 'image' not in request.files:
        return jsonify({"error": "Nenhuma imagem enviada"}), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "Nome de arquivo vazio"}), 400
        
    caption = request.form.get('caption', '')
    accounts_raw = request.form.get('accounts', '[]')
    try:
        accounts = json.loads(accounts_raw)
    except Exception:
        return jsonify({"error": "Formato de contas inválido"}), 400
        
    if not accounts:
        return jsonify({"error": "Selecione pelo menos uma conta para postar"}), 400
        
    # Salva temporariamente a imagem enviada
    uploads_dir = os.path.join(BASE_DIR, 'uploads')
    os.makedirs(uploads_dir, exist_ok=True)
    temp_filename = f"post_{int(time.time())}{os.path.splitext(file.filename)[1].lower()}"
    temp_path = os.path.join(uploads_dir, temp_filename)
    file.save(temp_path)
    
    # Resolve as senhas das contas
    resolved_accounts = []
    saved_accounts = load_saved_accounts()
    for acc_username in accounts:
        acc_username = acc_username.replace("@", "").strip()
        acc_password = saved_accounts.get(acc_username)
        if acc_password:
            resolved_accounts.append({"username": acc_username, "password": acc_password})
            
    if not resolved_accounts:
        try:
            os.remove(temp_path)
        except Exception:
            pass
        return jsonify({"error": "Nenhuma das contas selecionadas possui senha salva localmente"}), 400
        
    # Roda em thread separada
    def run_post_task():
        global bot_logs, bot_status
        bot_logs.clear()
        bot_status = "running"
        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Iniciando postagem automática em {len(resolved_accounts)} contas...")
        
        for idx, acc in enumerate(resolved_accounts):
            username = acc['username']
            password = acc['password']
            bot_logs.append(f"[{time.strftime('%H:%M:%S')}] [@{username}] Conectando para publicar...")
            
            from instagrapi import Client
            cl = Client()
            cl.delay_range = [2, 5]
            proxy = os.environ.get("INSTAGRAM_PROXY")
            if proxy:
                cl.set_proxy(proxy)
                
            try:
                session_file = f"session_{username}.json"
                if os.path.exists(session_file):
                    try:
                        cl.load_settings(session_file)
                        cl.login(username, password)
                    except Exception:
                        cl.login(username, password)
                        cl.dump_settings(session_file)
                else:
                    cl.login(username, password)
                    cl.dump_settings(session_file)
                    
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] [@{username}] Login OK. Publicando imagem...")
                media = cl.photo_upload(temp_path, caption)
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] SUCESSO: Post publicado na conta @{username} (ID: {media.pk})")
            except Exception as ex:
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] ERRO ao publicar na conta @{username}: {str(ex)}")
                
            if idx < len(resolved_accounts) - 1:
                delay = random.randint(10, 30)
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Aguardando {delay} segundos antes da próxima conta...")
                time.sleep(delay)
                
        bot_status = "completed"
        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Processo de postagem automática em lote concluído!")
        try:
            os.remove(temp_path)
        except Exception:
            pass
            
    threading.Thread(target=run_post_task).start()
    return jsonify({"status": "started", "message": "Automação de postagem iniciada em segundo plano!"})

# Rota para obter configurações salvas no servidor (ex: chave SMS)
@app.route('/api/settings', methods=['GET'])
def get_settings_route():
    return jsonify(load_settings())

# Rota para salvar configurações no servidor
@app.route('/api/settings', methods=['POST'])
def save_settings_route():
    data = request.json or {}
    settings = load_settings()
    for k, v in data.items():
        settings[k] = v
    save_settings(settings)
    return jsonify({"status": "success", "message": "Configurações salvas!"})

# Rota para criar contas de forma automatizada usando creator.py
@app.route('/api/accounts/create', methods=['POST'])
def accounts_create_route():
    global bot_status, bot_logs, creator_process, bot_progress
    if bot_status == "running":
        return jsonify({"error": "O robô de disparos ou criação já está em execução"}), 400

    data = request.json or {}
    sms_key = data.get('sms_key', '').strip()
    country = data.get('country', 'brazil').strip()
    username_prefix = data.get('username_prefix', 'sdg').strip()
    password = data.get('password', '').strip()
    proxy = data.get('proxy', '').strip()
    count = int(data.get('count', 1))

    # Salva ou carrega as configurações no servidor
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
        import shlex
        
        # Constrói comando para executar o script creator.py
        # Usamos sys.executable para chamar o mesmo interpretador Python (ou server.exe se compilado)
        cmd = [sys.executable, os.path.join(BASE_DIR, "creator.py")]
        
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
        if count:
            cmd.extend(["--count", str(count)])

        bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Iniciando processo de criação automática...")
        
        try:
            # Roda o subprocesso capturando stdout/stderr em tempo real
            # No Windows, precisamos passar creationflags=subprocess.CREATE_NO_WINDOW se quisermos esconder o console secundário
            creator_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                cwd=BASE_DIR,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )

            # Lê a saída linha por linha
            for line in iter(creator_process.stdout.readline, ''):
                clean_line = line.strip()
                if clean_line:
                    bot_logs.append(clean_line)
                    
                    # Atualiza o progresso analisando mensagens específicas
                    if "Iniciando criação da conta" in clean_line:
                        try:
                            # Ex: "Iniciando criação da conta 1: @sdg_abc..."
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
            # Se der erro por falta de interpretador python (como no executável compilado sem python externo)
            if "FileNotFoundError" in str(type(e)) or "sistema não pode encontrar" in str(e):
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] DICA: O Python não está instalado nesta máquina ou não está no PATH.")
                bot_logs.append(f"[{time.strftime('%H:%M:%S')}] Por favor, execute o arquivo 'instalar_python.bat' na raiz do sistema para instalar automaticamente!")

        finally:
            creator_process = None

    threading.Thread(target=run_creator_process).start()
    return jsonify({"status": "started", "message": "Processo de criação automática de contas iniciado!"})

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

# Sincronização em tempo real das conversas, posts e seguidores
@app.route('/api/sync', methods=['POST'])
def sync_data():
    accounts_dict = load_saved_accounts()
    if not accounts_dict:
        return jsonify({"error": "Nenhuma conta cadastrada para sincronização. Adicione uma conta nas configurações do Disparo."}), 400
    
    # Obtém o usuário a ser sincronizado (ou usa o primeiro da lista)
    data = request.json or {}
    username = data.get('username') or list(accounts_dict.keys())[0]
    username = username.strip().replace("@", "")
    
    if username not in accounts_dict:
        return jsonify({"error": f"Conta @{username} não encontrada nas contas salvas."}), 404
        
    password = accounts_dict[username]
    
    try:
        from instagrapi import Client
        cl = Client()
        cl.delay_range = [2, 5]
        
        # Suporta proxy
        proxy = os.environ.get("INSTAGRAM_PROXY")
        if proxy:
            cl.set_proxy(proxy)
            
        # Carrega sessão se existir
        session_file = os.path.join(BASE_DIR, f"session_{username}.json")
        if os.path.exists(session_file):
            try:
                cl.load_settings(session_file)
                cl.login(username, password)
            except Exception:
                cl.login(username, password)
                cl.dump_settings(session_file)
        else:
            cl.login(username, password)
            cl.dump_settings(session_file)
            
        user_id = cl.user_id
        
        # 1. Informações básicas do Perfil
        info = cl.user_info(user_id)
        
        # 2. Seguidores (limitamos a 100 para ser rápido)
        followers_dict = cl.user_followers(user_id, amount=100)
        
        # 3. Posts recentes (12 posts)
        medias = cl.user_medias(user_id, amount=12)
        
        # 4. Direct Threads (Conversas) (20 threads)
        threads = cl.direct_threads(amount=20)
        
        # Processar seguidores
        followers_cache = []
        for fid, fuser in followers_dict.items():
            gender, age_group, age_range, city = infer_demographics(fuser.username)
            followers_cache.append({
                "username": fuser.username,
                "timestamp": int(time.time() * 1000), # aproximado
                "followed_back": True,
                "gender": gender,
                "age_group": age_group,
                "age_range": age_range,
                "city": city
            })
            
        # Processar posts
        posts_cache = []
        for media in medias:
            img_url = media.thumbnail_url
            if not img_url and media.resources:
                img_url = media.resources[0].thumbnail_url
            if not img_url:
                img_url = "https://picsum.photos/400/400"
                
            posts_cache.append({
                "id": str(media.id),
                "imageUrl": str(img_url),
                "caption": media.caption_text or "Sem legenda",
                "likes": media.like_count,
                "commentsCount": media.comment_count,
                "date": media.taken_at.strftime('%Y-%m-%d') if media.taken_at else time.strftime('%Y-%m-%d')
            })
            
        # Processar conversas
        chats_cache = []
        for thread in threads:
            participants = [u.full_name or u.username for u in thread.users]
            last_msg = ""
            messages = []
            
            try:
                # Pega as últimas 20 mensagens da thread
                thread_messages = cl.direct_messages(thread.id, amount=20)
                # Ordena da mais antiga para a mais recente
                thread_messages.sort(key=lambda x: x.timestamp)
                
                for m in thread_messages:
                    is_me = m.user_id == int(cl.user_id)
                    sender_name = info.full_name or info.username if is_me else (thread.users[0].full_name or thread.users[0].username if thread.users else "Seguidor")
                    
                    msg_time = m.timestamp.strftime('%H:%M') if m.timestamp else ""
                    msg_date = m.timestamp.strftime('%d/%m/%Y') if m.timestamp else ""
                    
                    messages.append({
                        "sender": sender_name,
                        "content": m.text or "[Mídia / Compartilhamento]",
                        "time": msg_time,
                        "date": msg_date,
                        "timestamp_ms": int(m.timestamp.timestamp() * 1000) if m.timestamp else 0,
                        "isMe": is_me
                    })
            except Exception as thread_err:
                print(f"Erro ao ler mensagens da conversa {thread.id}: {thread_err}")
            
            if messages:
                last_msg = messages[-1]["content"]
                last_time = messages[-1]["time"]
                last_ts = messages[-1]["timestamp_ms"]
            else:
                last_msg = "Sem mensagens"
                last_time = ""
                last_ts = 0
                
            thread_title = thread.thread_title or (thread.users[0].username if thread.users else "Conversa")
            chats_cache.append({
                "id": thread.id,
                "sender": thread_title,
                "avatar": f"https://api.dicebear.com/7.x/initials/svg?seed={thread_title}",
                "lastMessage": last_msg,
                "time": last_time,
                "timestamp_ms": last_ts,
                "unread": False,
                "participants": participants + [info.full_name or info.username],
                "messages": messages
            })
            
        chats_cache.sort(key=lambda x: x['timestamp_ms'], reverse=True)
            
        cache_data = {
            "username": username,
            "profile": {
                "username": info.username,
                "full_name": info.full_name,
                "follower_count": info.follower_count,
                "following_count": info.following_count,
                "media_count": info.media_count
            },
            "followers": followers_cache,
            "posts": posts_cache,
            "chats": chats_cache,
            "synced_at": int(time.time() * 1000)
        }
        
        with open(LIVE_CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, indent=2, ensure_ascii=False)
            
        return jsonify({"status": "synced", "username": username, "followers_count": len(followers_cache)})
        
    except Exception as e:
        print(f"Erro na sincronização em tempo real: {e}")
        return jsonify({"error": f"Falha na sincronização: {str(e)}"}), 500

def run_headless_campaign():
    print("\n" + "="*50)
    print("      EXECUTOR DE CAMPANHA PORTÁTIL (HEADLESS)")
    print("="*50)
    
    config_path = os.path.join(BASE_DIR, 'campanha.json')
    if not os.path.exists(config_path):
        print(f"\n[-] Erro: O arquivo '{config_path}' não foi encontrado.")
        print("[*] Salve a campanha como 'campanha.json' no pen drive/pasta junto do programa.")
        input("\nPressione ENTER para fechar...")
        return
        
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            camp = json.load(f)
    except Exception as e:
        print(f"\n[-] Erro ao ler '{config_path}': {e}")
        input("\nPressione ENTER para fechar...")
        return
        
    campaign_type = camp.get('campaign_type')
    if not campaign_type:
        # Fallback para compatibilidade anterior
        if camp.get('post_url') and (camp.get('like') or camp.get('share') or camp.get('comment')):
            campaign_type = 'post_action'
        elif camp.get('action') == 'follow':
            campaign_type = 'follow'
        else:
            campaign_type = 'messages'
            
    action = camp.get('action', 'message')
    if campaign_type == 'follow':
        action = 'follow'
    elif campaign_type == 'messages' and action == 'follow':
        action = 'message'
        
    like = bool(camp.get('like', False))
    share = bool(camp.get('share', False))
    comment = bool(camp.get('comment', False))
    comment_text = camp.get('comment_text', '')
    
    # 1. Resolver contas
    accounts = camp.get('accounts', [])
    if not accounts:
        # Tenta carregar do accounts.json local
        saved_accounts = load_saved_accounts()
        accounts = [{"username": u, "password": p} for u, p in saved_accounts.items()]
        
    if not accounts:
        print("\n[-] Nenhuma conta cadastrada em 'campanha.json' ou 'accounts.json'.")
        username = input("[?] Digite o usuário do Instagram (@conta): ").strip().replace("@", "")
        password = input("[?] Digite a senha: ").strip()
        if not username or not password:
            print("[-] Dados inválidos. Cancelando.")
            input("\nPressione ENTER para fechar...")
            return
        accounts = [{"username": username, "password": password}]
        
    # 2. Resolver destinatários (Leads)
    leads = camp.get('leads', [])
    if not leads:
        # Tenta ler de leads.txt no mesmo diretório
        leads_path = os.path.join(BASE_DIR, 'leads.txt')
        if os.path.exists(leads_path):
            try:
                with open(leads_path, 'r', encoding='utf-8') as lf:
                    leads = [line.strip() for line in lf if line.strip()]
                print(f"\n[+] Carregados {len(leads)} destinatários do arquivo 'leads.txt'.")
            except Exception as e:
                print(f"[-] Erro ao ler 'leads.txt': {e}")
                
    # Precisa de leads se a ação enviar mensagem ou se for compartilhar/comentar post
    needs_leads = (action in ('message', 'both')) or share or comment
    if needs_leads and not leads:
        print("\n[-] Nenhum destinatário carregado de 'campanha.json' ou 'leads.txt'.")
        leads_input = input("[?] Digite os arrobas dos destinatários (separados por vírgula): ")
        leads = [l.strip().replace("@", "") for l in leads_input.split(",") if l.strip()]
        if not leads:
            print("[-] Nenhum destinatário fornecido. Cancelando.")
            input("\nPressione ENTER para fechar...")
            return

    # 3. Resolver Gemini
    use_gemini = camp.get('use_gemini', False)
    gemini_api_key = camp.get('gemini_api_key')
    gemini_prompt = camp.get('gemini_prompt', '')
    
    # Se usar Gemini ou prompt configurado, e faltar chave/prompt, pergunta no console
    if use_gemini or gemini_prompt:
        if not gemini_api_key:
            gemini_api_key = input("\n[?] Digite a API Key do Gemini (IA): ").strip()
        if not gemini_prompt:
            gemini_prompt = input("[?] Digite a instrução/prompt para a IA: ").strip()
        
    # 4. Resolver Mensagem Padrão (se não usar IA)
    message = camp.get('message', '')
    if action in ('message', 'both') and not message and not gemini_prompt and not use_gemini:
        message = input("\n[?] Digite o texto da mensagem padrão: ").strip()
        if not message:
            print("[-] Mensagem padrão obrigatória. Cancelando.")
            input("\nPressione ENTER para fechar...")
            return
            
    # 5. Resolver URL do Post (caso seja curtir, compartilhar ou comentar)
    post_url = camp.get('post_url', '')
    if (like or share or comment) and not post_url:
        post_url = input("\n[?] Digite o link da publicação do Instagram (Post ou Reel): ").strip()
        if not post_url:
            print("[-] Link da publicação obrigatório para curtir/compartilhar/comentar. Cancelando.")
            input("\nPressione ENTER para fechar...")
            return

    # Delays
    min_delay = int(camp.get('min_delay', 5))
    max_delay = int(camp.get('max_delay', 15))
    rotate_every = int(camp.get('rotate_every', 1))
    
    print("\n[+] Configurações da Campanha:")
    print(f"    - Contas de disparo: {', '.join('@' + a['username'] for a in accounts)}")
    print(f"    - Destinatários: {len(leads)}")
    print(f"    - Tipo de Campanha: {campaign_type}")
    if campaign_type == 'post_action':
        if post_url:
            print(f"    - Publicação: {post_url}")
        print(f"    - Curtir: {'Sim' if like else 'Não'}, Compartilhar: {'Sim' if share else 'Não'}, Comentar: {'Sim' if comment else 'Não'}")
    elif campaign_type == 'follow':
        print(f"    - Ação: Apenas Seguir Usuários")
    else:
        print(f"    - Ação: {action}")
        if gemini_prompt:
            print(f"    - IA (Gemini): Ativada (Prompt: '{gemini_prompt}')")
        else:
            print(f"    - Mensagem Padrão: '{message}'")
    print(f"    - Delays: {min_delay}s a {max_delay}s (Rotação a cada {rotate_every} envios)")
    print("="*50)
    
    confirm = input("\n[?] Deseja iniciar os disparos no pen drive agora? (s/n): ").strip().lower()
    if confirm != 's':
        print("[-] Operação cancelada.")
        input("\nPressione ENTER para fechar...")
        return
        
    print("\n[*] Iniciando disparos... (Pressione Ctrl+C para interromper no terminal)\n")
    
    # Redireciona os logs diretamente para o stdout da janela do terminal
    global bot_logs
    bot_logs = type('StdoutLogs', (object,), {
        'append': lambda self, msg: print(msg),
        'clear': lambda self: None
    })()
    
    try:
        if campaign_type == 'post_action':
            run_post_action_thread(
                accounts=accounts,
                post_url=post_url,
                like=like,
                share=share,
                leads=leads,
                min_delay=min_delay,
                max_delay=max_delay,
                rotate_every=rotate_every,
                gemini_api_key=gemini_api_key,
                gemini_prompt=gemini_prompt,
                comment=comment,
                comment_text=comment_text
            )
        else:
            run_bot_thread(
                accounts=accounts,
                message_template=message if campaign_type != 'follow' else '',
                leads=leads,
                min_delay=min_delay,
                max_delay=max_delay,
                rotate_every=rotate_every,
                action='follow' if campaign_type == 'follow' else action,
                gemini_api_key=gemini_api_key if campaign_type != 'follow' else None,
                gemini_prompt=gemini_prompt if campaign_type != 'follow' else None,
                audio_path=camp.get('audio_path')
            )
    except KeyboardInterrupt:
        print("\n[-] Interrompido pelo usuário.")
        
    input("\n[OK] Automação finalizada. Pressione ENTER para fechar...")

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
    if not os.path.exists(creator_path):
        try:
            creator_code = r"""import os
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
                return sms_list[0].get("code") or sms_list[0].get("text")
        return None

    def finish_order(self, activation_id):
        url = f"{self.url}/finish/{activation_id}"
        requests.get(url, headers=self.headers, timeout=10)

    def cancel_order(self, activation_id):
        url = f"{self.url}/cancel/{activation_id}"
        requests.get(url, headers=self.headers, timeout=10)

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
    suffix = "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=5))
    username = f"{username_prefix}_{suffix}"
    password = args.password or generate_random_password()
    full_name = generate_random_name()

    log(f"Iniciando criação da conta {account_idx}: @{username} / Senha: {password}...", "INFO")

    activation_id = None
    phone_number = None

    if sms_api:
        try:
            log(f"Solicitando número de telefone (País: {args.country}) no 5sim.net...", "SMS")
            activation_id, phone_number = sms_api.get_number(args.country)
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
            headless=False,
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

            try:
                cookie_buttons = page.query_selector_all("button:has-text('Permitir todos os cookies'), button:has-text('Aceitar tudo'), button:has-text('Accept')")
                if cookie_buttons:
                    cookie_buttons[0].click()
                    log("Cookies aceitos.", "INFO")
                    time.sleep(2)
            except Exception:
                pass

            log("Preenchendo formulário de cadastro...", "INFO")
            page.fill("input[name='emailOrPhone']", phone_number)
            page.fill("input[name='fullName']", full_name)
            page.fill("input[name='username']", username)
            page.fill("input[name='password']", password)
            time.sleep(2)

            log("Enviando dados de cadastro...", "INFO")
            submit_button = page.locator("button[type='submit']")
            submit_button.click()
            time.sleep(4)

            if "birthday" in page.url or page.query_selector("select[title='Mês:']") or page.query_selector("select[title='Month:']"):
                log("Preenchendo data de nascimento...", "INFO")
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

            if sms_api and activation_id:
                log("Aguardando código de SMS do Instagram no 5sim.net...", "SMS")
                sms_code = None
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

                log("Inserindo código de verificação no Instagram...", "INFO")
                code_input = page.locator("input[name='email_confirmation_code'], input[name='confirmationCode'], input[placeholder='Código de confirmação']")
                if code_input.count() > 0:
                    code_input.first.fill(sms_code)
                else:
                    page.fill("input", sms_code)

                time.sleep(2)
                
                confirm_button = page.locator("button[type='submit'], button:has-text('Avançar'), button:has-text('Confirmar')")
                confirm_button.first.click()
                time.sleep(10)

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
    
    args = parser.parse_args()

    log("==================================================", "INFO")
    log("   Criador Automático de Contas (5sim.net)        ", "INFO")
    log("==================================================", "INFO")

    sms_api = None
    if args.sms_key:
        sms_api = FivesimAPI(args.sms_key)
        balance = sms_api.get_balance()
        log(f"Conectado ao 5sim.net. Saldo disponível: R$ {balance:.2f}", "SMS")
        if balance <= 0.0:
            log("AVISO: Seu saldo no 5sim.net está zerado. A compra de números pode falhar.", "AVISO")
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

if __name__ == '__main__':
    main()"""
            with open(creator_path, 'w', encoding='utf-8') as f:
                f.write(creator_code)
        except Exception as e:
            print(f"Erro ao gerar creator.py: {e}")

if __name__ == '__main__':
    ensure_helper_files()
    # Cria o arquivo iniciar_campanha.bat se ele não existir
    bat_path = os.path.join(BASE_DIR, 'iniciar_campanha.bat')
    if not os.path.exists(bat_path):
        try:
            with open(bat_path, 'w', encoding='utf-8') as bat_file:
                bat_file.write("@echo off\n")
                bat_file.write("server.exe --headless\n")
                bat_file.write("pause\n")
        except Exception as e:
            print(f"Erro ao criar iniciar_campanha.bat: {e}")

    # Verifica se foi solicitado execução headless
    if len(sys.argv) > 1 and sys.argv[1] == "--headless":
        run_headless_campaign()
        sys.exit(0)
        
    # Banner visual de inicialização
    print("\n" + "="*70)
    print("        INICIANDO SERVIDOR DE AUTOMAÇÃO (THENPERSON 2026)")
    print("="*70)
    print(" Endereço Local: http://localhost:5000")
    print(" Para acesso externo no Celular/Tablet, execute o ngrok:")
    print("   ngrok http 5000")
    print("")
    print(f" [TOKEN] CHAVE DE PAREAMENTO (API TOKEN): {SERVER_TOKEN}")
    print("="*70 + "\n")
    
    # Tenta obter a URL do ngrok para pareamento
    ngrok_url = get_ngrok_url()
    local_ip = get_local_ip()
    target_url = ngrok_url if ngrok_url else f"http://{local_ip}:5000"
    
    # Constrói o link de pareamento automático para o celular
    vercel_app_url = os.environ.get("VERCEL_APP_URL", "https://sdgtec.com.br")
    pairing_link = f"{vercel_app_url}/broadcast?api_url={target_url}&api_token={SERVER_TOKEN}"
    
    if not ngrok_url:
        print(" [!] Aviso: Ngrok nao detectado. Usando IP da rede local Wi-Fi.")
        print(f"     Certifique-se de que o Celular e o PC estao na MESMA rede Wi-Fi.")
    else:
        print(" [OK] SUCESSO: Ngrok detectado! Sincronizacao online ativa.")
    print("")
    
    print(" [LINK] LINK DE PAREAMENTO AUTOMATICO:")
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
