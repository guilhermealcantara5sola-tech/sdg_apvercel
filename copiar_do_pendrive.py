import os
import shutil
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEST_DIR = os.path.join(BASE_DIR, 'upload')

def copy_json_only(src_dir, dest_dir):
    print(f"\n[*] Iniciando cópia seletiva de arquivos JSON...")
    print(f"    Origem: {src_dir}")
    print(f"    Destino: {dest_dir}\n")
    
    os.makedirs(dest_dir, exist_ok=True)
    
    total_files = 0
    copied_files = 0
    
    # Percorre todos os diretórios e arquivos recursivamente
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.lower().endswith('.json'):
                total_files += 1
                
                # Obtém o caminho completo de origem
                src_file_path = os.path.join(root, file)
                
                # Calcula o caminho relativo para recriar as pastas no destino
                rel_path = os.path.relpath(root, src_dir)
                dest_folder_path = os.path.join(dest_dir, rel_path)
                
                # Cria a pasta de destino correspondente
                os.makedirs(dest_folder_path, exist_ok=True)
                
                # Copia o arquivo
                dest_file_path = os.path.join(dest_folder_path, file)
                try:
                    shutil.copy2(src_file_path, dest_file_path)
                    copied_files += 1
                    sys.stdout.write(f"\rProgresso: {copied_files} arquivos JSON copiados.")
                    sys.stdout.flush()
                except Exception as e:
                    print(f"\n[!] Erro ao copiar '{file}': {e}")
                    
    print(f"\n\n[+] Concluído! Copiados {copied_files} arquivos de texto JSON (Tamanho total aproximado: < 30MB).")
    print("[*] As mídias pesadas (fotos, vídeos e áudios) foram ignoradas com sucesso.")

def main():
    print("="*60)
    print("         COPIADOR INTELIGENTE DE DADOS DO PEN DRIVE")
    print("="*60)
    print("Este utilitário resolve o problema de falta de espaço em disco no PC.")
    print("Ele copia apenas os dados de texto (JSON) do pen drive e descarta os 30GB de mídias.")
    print("="*60 + "\n")
    
    # Pergunta a letra do pen drive ou o caminho completo
    drive_input = input("[?] Digite o caminho da pasta do Instagram no pen drive (ex: E:\\instagram-usuario-data): ").strip()
    
    if not drive_input:
        print("[-] Caminho inválido.")
        input("\nPressione ENTER para sair...")
        return
        
    # Remove aspas caso o usuário tenha arrastado a pasta para o console
    drive_input = drive_input.replace('"', '').replace("'", "")
    
    if not os.path.exists(drive_input):
        print(f"[-] Erro: O caminho '{drive_input}' não foi encontrado.")
        print("    Certifique-se de que o pen drive está conectado e o caminho está correto.")
        input("\nPressione ENTER para sair...")
        return
        
    copy_json_only(drive_input, DEST_DIR)
    
    print("\n[+] Pronto! Agora os arquivos necessários estão na pasta local 'upload'.")
    print("[*] Você já pode rodar o arquivo 'importar_dados.bat' para sincronizar com o sistema.")
    input("\nPressione ENTER para sair...")

if __name__ == '__main__':
    main()
