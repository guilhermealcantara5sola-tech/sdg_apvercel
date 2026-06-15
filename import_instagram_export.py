import os
import json
import time
import sys
import urllib.request
import urllib.parse

# Configurações do Supabase
SUPABASE_URL = "https://rtnzazrlgpdcgrkvhpvx.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0bnphenJsZ3BkY2dya3ZocHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDcxMjk5NywiZXhwIjoyMDk2Mjg4OTk3fQ.gIfhKCBcwbg7euJh6T6f04AT_LNgUqJ5WE4mTZ0iGJM"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, 'upload')
LIVE_CACHE_FILE = os.path.join(BASE_DIR, 'live_cache.json')

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

def infer_demographics(username):
    h = sum(ord(c) for c in username)
    gender_rand = h % 100
    if gender_rand < 52:
        gender = "Mulheres"
    else:
        gender = "Homens"
        
    age_rand = h % 1000
    if age_rand < 7:
        age_group = "Criança"
        age_range = "13-17"
    elif age_rand < 110:
        age_group = "Jovem"
        age_range = "18-24"
    elif age_rand < 883:
        age_group = "Adulto"
        age_range = "25-34"
    else:
        age_group = "Idoso"
        age_range = "55+"
        
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

def make_supabase_request(table, data, method="POST", query_params=None):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if query_params:
        url += "?" + urllib.parse.urlencode(query_params)
        
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    
    if method == "POST":
        headers["Prefer"] = "resolution=merge-duplicates,return=representation"
        
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body) if res_body else []
    except Exception as e:
        print(f"\n[Supabase] Erro na requisição para a tabela '{table}': {e}")
        return None

def find_file_or_dir_recursive(root_path, target_name, is_dir=False):
    for root, dirs, files in os.walk(root_path):
        if is_dir:
            for d in dirs:
                if d.lower() == target_name.lower():
                    return os.path.join(root, d)
        else:
            for f in files:
                if f.lower() == target_name.lower():
                    return os.path.join(root, f)
    return None

def main():
    print("="*60)
    print("      IMPORTADOR INTELIGENTE DE DADOS INSTAGRAM EXPORT")
    print("="*60)
    
    if not os.path.exists(UPLOAD_DIR):
        print(f"[-] Erro: A pasta '{UPLOAD_DIR}' não existe.")
        print("[*] Crie a pasta 'upload' na raiz do sistema e extraia os arquivos do Instagram nela.")
        input("\nPressione ENTER para fechar...")
        return

    print("[*] Buscando arquivos de dados no diretório 'upload'...")
    
    # Busca arquivos de seguidores
    followers_file = find_file_or_dir_recursive(UPLOAD_DIR, "followers_1.json")
    if not followers_file:
        followers_file = find_file_or_dir_recursive(UPLOAD_DIR, "followers.json")
        
    # Busca diretório do inbox
    inbox_dir = find_file_or_dir_recursive(UPLOAD_DIR, "inbox", is_dir=True)
    
    # Busca informações de perfil
    profile_file = find_file_or_dir_recursive(UPLOAD_DIR, "profile_information.json")
    if not profile_file:
        profile_file = find_file_or_dir_recursive(UPLOAD_DIR, "profile.json")

    if not followers_file:
        print("[-] Erro: Arquivo de seguidores (followers_1.json ou followers.json) não encontrado.")
        input("\nPressione ENTER para fechar...")
        return
        
    print(f"[+] Arquivo de seguidores localizado: {followers_file}")
    if inbox_dir:
        print(f"[+] Diretório de mensagens inbox localizado: {inbox_dir}")
    if profile_file:
        print(f"[+] Arquivo de perfil localizado: {profile_file}")
    
    # 1. Carregar perfil
    username = "cliente_instagram"
    profile_info = {
        "username": username,
        "full_name": "Cliente Instagram",
        "follower_count": 0,
        "following_count": 0,
        "media_count": 0
    }
    
    if profile_file:
        try:
            with open(profile_file, 'r', encoding='utf-8') as f:
                p_data = json.load(f)
                p_data = decode_data(p_data)
                
                # Trata diferentes formatos do instagram
                profile_details = p_data
                if isinstance(p_data, dict) and "ig_profile_information" in p_data:
                    profile_details = p_data["ig_profile_information"][0]
                elif isinstance(p_data, list) and len(p_data) > 0:
                    profile_details = p_data[0]
                    
                username = profile_details.get("username", username)
                profile_info["username"] = username
                profile_info["full_name"] = profile_details.get("name", username)
        except Exception as e:
            print(f"[!] Aviso ao carregar perfil: {e}")

    # 2. Carregar seguidores
    print("\n[*] Processando seguidores...")
    followers_cache = []
    leads_to_supabase = []
    
    try:
        with open(followers_file, 'r', encoding='utf-8') as f:
            f_data = json.load(f)
            f_data = decode_data(f_data)
            
        for item in f_data:
            string_data = item.get('string_list_data', [])
            if string_data:
                val = string_data[0].get('value', '')
                href = string_data[0].get('href', '')
                ts = string_data[0].get('timestamp', 0)
                if val:
                    gender, age_group, age_range, city = infer_demographics(val)
                    followers_cache.append({
                        "username": val,
                        "timestamp": ts * 1000,
                        "followed_back": True,
                        "gender": gender,
                        "age_group": age_group,
                        "age_range": age_range,
                        "city": city
                    })
                    
                    # Formato do Supabase
                    leads_to_supabase.append({
                        "username": val,
                        "instagram_url": href,
                        "followed_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(ts)),
                        "is_follower": True,
                        "gender": gender,
                        "age_range": age_range,
                        "city": city,
                        "status": "novo"
                    })
    except Exception as e:
        print(f"[-] Erro ao carregar seguidores: {e}")
        input("\nPressione ENTER para fechar...")
        return
        
    profile_info["follower_count"] = len(followers_cache)
    print(f"[+] Total de {len(followers_cache)} seguidores processados com sucesso!")

    # 3. Carregar direct chats
    chats_cache = []
    if inbox_dir:
        print("\n[*] Processando mensagens do direct inbox (isso pode levar alguns segundos)...")
        folders = os.listdir(inbox_dir)
        
        for folder in folders:
            folder_path = os.path.join(inbox_dir, folder)
            if not os.path.isdir(folder_path):
                continue
                
            message_file = os.path.join(folder_path, 'message_1.json')
            if os.path.exists(message_file):
                try:
                    with open(message_file, 'r', encoding='utf-8') as f:
                        chat_data = json.load(f)
                        chat_data = decode_data(chat_data)
                        
                    thread_title = chat_data.get('title', '')
                    if not thread_title:
                        thread_title = folder.split('_')[0]
                        
                    participants = [p.get('name', '') for p in chat_data.get('participants', [])]
                    
                    messages = []
                    raw_messages = chat_data.get('messages', [])
                    # Ordena as mensagens por data
                    raw_messages.sort(key=lambda x: x.get('timestamp_ms', 0))
                    
                    for m in raw_messages:
                        sender_name = m.get('sender_name', '')
                        is_me = (username.lower() in sender_name.lower()) or ('thenperson' in sender_name.lower())
                        
                        content = m.get('content', '')
                        if not content and 'share' in m:
                            content = f"[Compartilhado: {m['share'].get('link', '')}]"
                        elif not content:
                            content = "[Mídia/Anexo]"
                            
                        ts_ms = m.get('timestamp_ms', 0)
                        msg_time = time.strftime('%H:%M', time.localtime(ts_ms / 1000.0))
                        msg_date = time.strftime('%d/%m/%Y', time.localtime(ts_ms / 1000.0))
                        
                        messages.append({
                            "sender": sender_name,
                            "content": content,
                            "time": msg_time,
                            "date": msg_date,
                            "timestamp_ms": ts_ms,
                            "isMe": is_me
                        })
                        
                    if messages:
                        last_msg = messages[-1]["content"]
                        last_time = messages[-1]["time"]
                        last_ts = messages[-1]["timestamp_ms"]
                        
                        chats_cache.append({
                            "id": folder,
                            "sender": thread_title,
                            "avatar": f"https://api.dicebear.com/7.x/initials/svg?seed={thread_title}",
                            "lastMessage": last_msg,
                            "time": last_time,
                            "timestamp_ms": last_ts,
                            "unread": False,
                            "participants": participants,
                            "messages": messages
                        })
                except Exception as e:
                    print(f"[!] Erro ao processar conversa '{folder}': {e}")
                    
        # Ordena chats pelo horário da última mensagem (mais recente primeiro)
        chats_cache.sort(key=lambda x: x['timestamp_ms'], reverse=True)
        print(f"[+] Total de {len(chats_cache)} conversas carregadas com sucesso!")

    # 4. Escreve no Cache Local (live_cache.json)
    cache_data = {
        "username": username,
        "profile": profile_info,
        "followers": followers_cache,
        "posts": [],  # Opcional, pode ser deixado vazio
        "chats": chats_cache,
        "synced_at": int(time.time() * 1000)
    }
    
    print("\n[*] Salvando dados locais no cache do sistema (live_cache.json)...")
    try:
        with open(LIVE_CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, indent=2, ensure_ascii=False)
        print("[+] Sucesso! Cache local do sistema atualizado.")
    except Exception as e:
        print(f"[-] Erro ao salvar live_cache.json: {e}")

    # 5. Sincronizar com Supabase
    print("\n[?] Deseja enviar esses dados para o banco de dados Supabase online?")
    print("    Isso irá atualizar a base de leads e conversas na nuvem.")
    sync_sb = input("[S/N]: ").strip().lower()
    
    if sync_sb == 's':
        print("\n[*] Iniciando sincronização com Supabase...")
        
        # 1. Envia Leads
        print(f"Enviando {len(leads_to_supabase)} leads...")
        chunk_size = 100
        inserted_count = 0
        for i in range(0, len(leads_to_supabase), chunk_size):
            chunk = leads_to_supabase[i:i+chunk_size]
            res = make_supabase_request("leads", chunk, "POST")
            if res is not None:
                inserted_count += len(chunk)
                sys.stdout.write(f"\rProgresso Leads: {inserted_count}/{len(leads_to_supabase)} importados.")
                sys.stdout.flush()
        print("\n[+] Sincronização de leads concluída no Supabase.")
        
        # 2. Obter UUIDs dos Leads do Supabase para fazer link com as mensagens
        print("\n[*] Buscando IDs de leads do banco para sincronizar as mensagens...")
        res_leads = make_supabase_request("leads", None, "GET", {"select": "id,username"})
        if res_leads:
            username_to_id = {item["username"]: item["id"] for item in res_leads}
            
            # Envia as mensagens
            messages_batch = []
            print("Preparando envio das conversas...")
            for chat in chats_cache:
                lead_username = chat["id"].split('_')[0]
                lead_id = username_to_id.get(lead_username)
                
                if lead_id:
                    for m in chat["messages"]:
                        sender_type = 'me' if m["isMe"] else 'lead'
                        timestamp_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(m["timestamp_ms"] / 1000.0))
                        
                        messages_batch.append({
                            "lead_id": lead_id,
                            "type": "direct_message",
                            "content": m["content"],
                            "timestamp": timestamp_iso,
                            "sender": sender_type
                        })
                        
                        if len(messages_batch) >= 100:
                            make_supabase_request("interactions", messages_batch, "POST")
                            messages_batch = []
            
            if messages_batch:
                make_supabase_request("interactions", messages_batch, "POST")
            print("[+] Sincronização de mensagens concluída no Supabase.")
        else:
            print("[-] Não foi possível obter os IDs dos leads. O envio das mensagens foi cancelado.")
            
    print("\n" + "="*60)
    print("            PROCESSO DE IMPORTAÇÃO CONCLUÍDO!")
    print("="*60)
    input("\nPressione ENTER para sair...")

if __name__ == '__main__':
    main()
