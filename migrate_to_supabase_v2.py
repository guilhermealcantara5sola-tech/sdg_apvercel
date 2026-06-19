import os
import json
import time
import urllib.request
import urllib.parse
import sys

# Configurações do Supabase
SUPABASE_URL = "https://rtnzazrlgpdcgrkvhpvx.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0bnphenJsZ3BkY2dya3ZocHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDcxMjk5NywiZXhwIjoyMDk2Mjg4OTk3fQ.gIfhKCBcwbg7euJh6T6f04AT_LNgUqJ5WE4mTZ0iGJM"

EXPORT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'GUI_ADD', 'instagram-thenperson-2026-06-03-qLooPzkL')

def make_supabase_request(table, data, method="POST", query_params=None, extra_headers=None):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if query_params:
        url += "?" + urllib.parse.urlencode(query_params)
        
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    
    if extra_headers:
        headers.update(extra_headers)
        
    if method == "POST":
        headers["Prefer"] = "resolution=merge-duplicates,return=representation"
        
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body) if res_body else []
    except Exception as e:
        print(f"\nErro na requisição para a tabela '{table}': {e}")
        if hasattr(e, 'read'):
            try:
                print(e.read().decode("utf-8"))
            except:
                pass
        return None

def fetch_all_leads():
    print("Buscando todos os leads cadastrados no Supabase (com paginação)...")
    offset = 0
    limit = 1000
    username_to_id = {}
    
    while True:
        headers = {
            "Range": f"{offset}-{offset+limit-1}"
        }
        url = f"leads"
        res = make_supabase_request(url, None, "GET", {"select": "id,username"}, extra_headers=headers)
        if res:
            for item in res:
                username_to_id[item["username"]] = item["id"]
            if len(res) < limit:
                break
            offset += limit
        else:
            break
            
    print(f"Mapeados {len(username_to_id)} leads.")
    return username_to_id

def extract_username_from_folder(folder):
    parts = folder.rsplit('_', 1)
    if len(parts) == 2 and parts[1].isdigit():
        return parts[0]
    return folder

def main():
    print("=== INICIANDO MIGRAÇÃO AVANÇADA (JSON EXCLUSIVO) ===")
    
    # 1. Obter seguidores de followers_1.json
    followers_path = os.path.join(EXPORT_DIR, 'connections', 'followers_and_following', 'followers_1.json')
    followers_set = set()
    if os.path.exists(followers_path):
        with open(followers_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        for item in data:
            string_data = item.get('string_list_data', [])
            if string_data:
                val = string_data[0].get('value', '')
                if val:
                    followers_set.add(val.lower())
    print(f"Seguidores no backup: {len(followers_set)}")
    
    # 2. Obter usernames das conversas do Direct
    inbox_dir = os.path.join(EXPORT_DIR, 'your_instagram_activity', 'messages', 'inbox')
    inbox_users = set()
    if os.path.exists(inbox_dir):
        for folder in os.listdir(inbox_dir):
            if os.path.isdir(os.path.join(inbox_dir, folder)):
                username = extract_username_from_folder(folder)
                inbox_users.add(username.lower())
    print(f"Usuários com conversa no direct: {len(inbox_users)}")
    
    # 3. Consolidar todos os leads (Seguidores + Inbox)
    all_usernames = followers_set.union(inbox_users)
    print(f"Total de leads únicos a cadastrar: {len(all_usernames)}")
    
    leads_to_insert = []
    for user in all_usernames:
        is_follower = user in followers_set
        leads_to_insert.append({
            "username": user,
            "instagram_url": f"https://instagram.com/{user}",
            "followed_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()) if is_follower else None,
            "is_follower": is_follower,
            "status": "novo"
        })
        
    # 4. Enviar os leads com UPSERT (on_conflict=username) para não dar conflito
    print("Inserindo/Atualizando leads no Supabase...")
    chunk_size = 100
    inserted_count = 0
    for i in range(0, len(leads_to_insert), chunk_size):
        chunk = leads_to_insert[i:i+chunk_size]
        res = make_supabase_request("leads", chunk, "POST", query_params={"on_conflict": "username"})
        if res is not None:
            inserted_count += len(chunk)
            sys.stdout.write(f"\rProgresso Leads: {inserted_count}/{len(leads_to_insert)} processados.")
            sys.stdout.flush()
            
    print("\nLeads atualizados com sucesso.")
    
    # 5. Obter UUIDs mapeados
    username_to_id = fetch_all_leads()
    
    # 6. Importar Mensagens
    if os.path.exists(inbox_dir):
        print("Migrando mensagens...")
        total_messages = 0
        interactions_batch = []
        
        folders = os.listdir(inbox_dir)
        for folder in folders:
            folder_path = os.path.join(inbox_dir, folder)
            if not os.path.isdir(folder_path):
                continue
                
            message_file = os.path.join(folder_path, 'message_1.json')
            if os.path.exists(message_file):
                with open(message_file, 'r', encoding='utf-8') as f:
                    chat_data = json.load(f)
                
                # Mapear folder para lead
                username = extract_username_from_folder(folder).lower()
                lead_id = username_to_id.get(username)
                
                if lead_id:
                    messages = chat_data.get('messages', [])
                    for m in messages:
                        content = m.get('content', '')
                        if not content and 'share' in m:
                            content = f"[Compartilhado: {m['share'].get('link', '')}]"
                        elif not content:
                            content = "[Mídia/Anexo]"
                            
                        timestamp_ms = m.get('timestamp_ms', 0)
                        timestamp_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(timestamp_ms / 1000.0))
                        
                        sender = m.get('sender_name', '')
                        sender_type = 'me' if ('thenperson' in sender.lower() or 'oriebir' in sender.lower()) else 'lead'
                        
                        interactions_batch.append({
                            "lead_id": lead_id,
                            "type": "direct_message",
                            "content": content,
                            "timestamp": timestamp_iso,
                            "sender": sender_type,
                            "metadata": m
                        })
                        
                        if len(interactions_batch) >= 100:
                            make_supabase_request("interactions", interactions_batch, "POST")
                            total_messages += len(interactions_batch)
                            interactions_batch = []
                            sys.stdout.write(f"\rProgresso Mensagens: {total_messages} mensagens enviadas.")
                            sys.stdout.flush()
                            
        if interactions_batch:
            make_supabase_request("interactions", interactions_batch, "POST")
            total_messages += len(interactions_batch)
            
        print(f"\nSucesso: Total de {total_messages} mensagens migradas e vinculadas aos leads no Supabase.")
        
    # 7. Importar Métricas Gerais do Perfil
    print("\n--- Importando Métricas Gerais do Perfil ---")
    audience_path = os.path.join(EXPORT_DIR, 'logged_information', 'past_instagram_insights', 'audience_insights.json')
    reached_path = os.path.join(EXPORT_DIR, 'logged_information', 'past_instagram_insights', 'profiles_reached.json')
    
    total_followers = len(followers_set)
    new_followers = 0
    unfollowed = 0
    reach = 0
    interactions_count = total_messages if 'total_messages' in locals() else 0
    
    if os.path.exists(audience_path):
        try:
            with open(audience_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                insights = data.get('organic_insights_audience', [])
                if insights:
                    string_data = insights[0].get('string_map_data', {})
                    total_followers_val = string_data.get('Total de seguidores', {}).get('value', '0')
                    total_followers = int(total_followers_val.replace(',', '').replace('.', '').strip())
                    
                    unfollowed_val = string_data.get('Deixaram de seguir', {}).get('value', '0')
                    unfollowed = int(unfollowed_val.replace(',', '').replace('.', '').strip())
                    
                    new_followers_val = string_data.get('Seguidores', {}).get('value', '0')
                    new_followers = int(new_followers_val.replace(',', '').replace('.', '').strip())
        except Exception as e:
            print(f"Erro ao ler audience_insights: {e}")
            
    if os.path.exists(reached_path):
        try:
            with open(reached_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                insights = data.get('organic_insights_reach', [])
                if insights:
                    string_data = insights[0].get('string_map_data', {})
                    reach_val = string_data.get('Contas alcançadas', {}).get('value', '0')
                    reach = int(reach_val.replace(',', '').replace('.', '').strip())
        except Exception as e:
            print(f"Erro ao ler profiles_reached: {e}")
            
    metric_record = {
        "metric_date": "2026-06-03",
        "total_followers": total_followers,
        "new_followers": new_followers,
        "unfollowed": unfollowed,
        "reach": reach,
        "interactions_count": interactions_count
    }
    
    make_supabase_request("profile_metrics", [metric_record], "POST")
    print(f"Métricas importadas: Seguidores={total_followers}, Alcance={reach}, Mensagens={interactions_count}")
    print("\n=== PROCESSO DE MIGRAÇÃO CONCLUÍDO COM SUCESSO ===")

if __name__ == '__main__':
    main()
