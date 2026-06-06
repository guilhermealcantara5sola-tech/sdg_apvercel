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
        # resolution=merge-duplicates executa um UPSERT caso haja conflito de chaves primárias ou únicas
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

def import_followers():
    followers_path = os.path.join(EXPORT_DIR, 'connections', 'followers_and_following', 'followers_1.json')
    if not os.path.exists(followers_path):
        print(f"Erro: Arquivo de seguidores não encontrado em: {followers_path}")
        return []
        
    print("Lendo lista de seguidores locais...")
    with open(followers_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    leads = []
    for item in data:
        string_data = item.get('string_list_data', [])
        if string_data:
            val = string_data[0].get('value', '')
            href = string_data[0].get('href', '')
            ts = string_data[0].get('timestamp', 0)
            if val:
                leads.append({
                    "username": val,
                    "instagram_url": href,
                    "followed_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(ts)),
                    "is_follower": True,
                    "status": "novo"
                })
                
    print(f"Encontrados {len(leads)} seguidores. Enviando para a tabela 'leads' do Supabase...")
    
    # Envia em blocos de 100 para evitar estourar o limite de tamanho da requisição
    chunk_size = 100
    inserted_leads = []
    for i in range(0, len(leads), chunk_size):
        chunk = leads[i:i+chunk_size]
        res = make_supabase_request("leads", chunk, "POST")
        if res:
            inserted_leads.extend(res)
            sys.stdout.write(f"\rProgresso Leads: {len(inserted_leads)}/{len(leads)} importados.")
            sys.stdout.flush()
            
    print(f"\nSucesso: Leads importados/atualizados no Supabase.")
    return inserted_leads

def fetch_all_leads():
    print("Buscando mapeamento de UUIDs de leads no Supabase...")
    res = make_supabase_request("leads", None, "GET", {"select": "id,username"})
    if res:
        return {item["username"]: item["id"] for item in res}
    return {}

def import_messages(username_to_id):
    inbox_dir = os.path.join(EXPORT_DIR, 'your_instagram_activity', 'messages', 'inbox')
    if not os.path.exists(inbox_dir):
        print(f"Erro: Pasta de mensagens não encontrada em: {inbox_dir}")
        return
        
    print("Escaneando conversas do Direct...")
    folders = os.listdir(inbox_dir)
    
    total_messages = 0
    interactions_batch = []
    
    for folder in folders:
        folder_path = os.path.join(inbox_dir, folder)
        if not os.path.isdir(folder_path):
            continue
            
        message_file = os.path.join(folder_path, 'message_1.json')
        if os.path.exists(message_file):
            with open(message_file, 'r', encoding='utf-8') as f:
                chat_data = json.load(f)
                
            # Mapear pasta para ID de lead
            # Procura por prefixos ex: folder 'joaodev_12345' corresponde ao username 'joaodev'
            lead_id = None
            for username, uid in username_to_id.items():
                if folder.startswith(username + "_") or folder == username:
                    lead_id = uid
                    break
                    
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

def import_tags_and_link_leads(username_to_id):
    print("\n--- 4. Importando Tags e Vinculando aos Leads ---")
    default_tags = [
        {"name": "Liderança", "color": "#3b82f6"},
        {"name": "Apoiador", "color": "#10b981"},
        {"name": "Pendente", "color": "#f59e0b"},
        {"name": "Opositor", "color": "#ef4444"},
        {"name": "Contato Feito", "color": "#8b5cf6"}
    ]
    
    # 1. Inserir Tags
    make_supabase_request("tags", default_tags, "POST")
    
    # 2. Buscar UUIDs das Tags criadas
    print("Buscando UUIDs das tags no Supabase...")
    tags_res = make_supabase_request("tags", None, "GET")
    if not tags_res:
        print("Erro ao obter UUIDs das tags do Supabase.")
        return
        
    tag_name_to_id = {item["name"]: item["id"] for item in tags_res}
    contato_feito_tag_id = tag_name_to_id.get("Contato Feito")
    
    if not contato_feito_tag_id:
        print("Erro: Tag 'Contato Feito' não encontrada no banco.")
        return
        
    # 3. Vincular Leads que possuem mensagens à tag 'Contato Feito'
    inbox_dir = os.path.join(EXPORT_DIR, 'your_instagram_activity', 'messages', 'inbox')
    if not os.path.exists(inbox_dir):
        print("Aviso: Pasta de mensagens não encontrada. Pulando vínculo de tags.")
        return
        
    folders = os.listdir(inbox_dir)
    lead_tags_to_insert = []
    
    for folder in folders:
        folder_path = os.path.join(inbox_dir, folder)
        if not os.path.isdir(folder_path):
            continue
            
        lead_id = None
        for username, uid in username_to_id.items():
            if folder.startswith(username + "_") or folder == username:
                lead_id = uid
                break
                
        if lead_id:
            lead_tags_to_insert.append({
                "lead_id": lead_id,
                "tag_id": contato_feito_tag_id
            })
            
    if lead_tags_to_insert:
        print(f"Vinculando {len(lead_tags_to_insert)} leads que interagiram à tag 'Contato Feito'...")
        chunk_size = 100
        inserted_links = 0
        for i in range(0, len(lead_tags_to_insert), chunk_size):
            chunk = lead_tags_to_insert[i:i+chunk_size]
            res = make_supabase_request("lead_tags", chunk, "POST")
            if res is not None:
                inserted_links += len(chunk)
        print(f"Sucesso: {inserted_links} vínculos de tags salvos no Supabase.")

def import_profile_metrics():
    print("\n--- 5. Importando Métricas Gerais do Perfil ---")
    audience_path = os.path.join(EXPORT_DIR, 'logged_information', 'past_instagram_insights', 'audience_insights.json')
    reached_path = os.path.join(EXPORT_DIR, 'logged_information', 'past_instagram_insights', 'profiles_reached.json')
    
    total_followers = 0
    new_followers = 0
    unfollowed = 0
    reach = 0
    interactions_count = 0
    
    # 1. Calcular total de interações (mensagens) no direct
    inbox_dir = os.path.join(EXPORT_DIR, 'your_instagram_activity', 'messages', 'inbox')
    if os.path.exists(inbox_dir):
        try:
            folders = os.listdir(inbox_dir)
            for folder in folders:
                folder_path = os.path.join(inbox_dir, folder)
                message_file = os.path.join(folder_path, 'message_1.json')
                if os.path.exists(message_file):
                    with open(message_file, 'r', encoding='utf-8') as f:
                        chat_data = json.load(f)
                        interactions_count += len(chat_data.get('messages', []))
        except:
            pass
                    
    # 2. Ler audience_insights
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
            
    # 3. Ler profiles_reached
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
        "metric_date": "2026-06-03",  # Data do arquivo de exportação
        "total_followers": total_followers,
        "new_followers": new_followers,
        "unfollowed": unfollowed,
        "reach": reach,
        "interactions_count": interactions_count
    }
    
    print(f"Métricas calculadas: Seguidores={total_followers}, Alcance={reach}, Total Mensagens={interactions_count}")
    res = make_supabase_request("profile_metrics", [metric_record], "POST")
    if res is not None:
        print("Sucesso: Métricas gerais importadas para o Supabase.")

def main():
    global SUPABASE_KEY
    print("=== MIGRADO DE DADOS INSTAGRAM -> SUPABASE ===")
    
    if SUPABASE_KEY == "SUA_CHAVE_SERVICE_ROLE_AQUI" or not SUPABASE_KEY:
        print("\nATENÇÃO: Você precisa configurar sua chave 'service_role' do Supabase.")
        print("Essa chave é necessária para gravar os dados pulando as restrições de RLS.")
        key_input = input("Cole sua chave 'service_role' (ou pressione Enter para usar a padrão do script): ").strip()
        if key_input:
            SUPABASE_KEY = key_input
            
    if SUPABASE_KEY == "SUA_CHAVE_SERVICE_ROLE_AQUI" or not SUPABASE_KEY:
        print("Erro: Chave do Supabase não configurada. Abortando migração.")
        return
        
    # 1. Importar Leads
    import_followers()
    
    # 2. Buscar mapeamento de Usuários -> UUIDs do Banco
    username_to_id = fetch_all_leads()
    
    # 3. Importar Mensagens vinculadas aos UUIDs
    if username_to_id:
        import_messages(username_to_id)
        
        # 4. Importar Tags e associar a tag 'Contato Feito' aos Leads com mensagens
        import_tags_and_link_leads(username_to_id)
    else:
        print("Erro: Não foi possível obter IDs de leads para vincular as mensagens.")
        
    # 5. Importar Métricas Gerais
    import_profile_metrics()
        
    print("\n=== MIGRAÇÃO CONCLUÍDA COM SUCESSO ===")

if __name__ == '__main__':
    main()

