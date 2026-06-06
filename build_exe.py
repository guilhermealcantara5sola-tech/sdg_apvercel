import os
import sys
import subprocess
import shutil

def run_command(command, description):
    print(f"\n[+] Executando: {description}...")
    try:
        subprocess.run(command, check=True, shell=True)
    except subprocess.CalledProcessError as e:
        print(f"[-] Erro ao executar '{description}': {e}")
        sys.exit(1)

def main():
    print("==================================================")
    print("   Compilador do Servidor Automático - Thenperson")
    print("==================================================")

    # 1. Verificar/Instalar dependências básicas
    run_command(
        f"{sys.executable} -m pip install --upgrade pip", 
        "atualizar o pip"
    )
    
    dependencies = ["pyinstaller", "flask", "flask-cors", "instagrapi", "qrcode"]
    print(f"[+] Verificando/Instalando dependências: {', '.join(dependencies)}")
    run_command(
        f"{sys.executable} -m pip install {' '.join(dependencies)}", 
        "instalar dependências do Python"
    )

    # 2. Compilar usando PyInstaller
    # --paths adiciona o diretório do core.py para ser embutido diretamente no executável
    # --onefile gera um único executável
    # --clean limpa o cache do PyInstaller
    build_path = os.path.join("GUI_ADD", "Ferramenta de disparo")
    pyinstaller_cmd = (
        f"pyinstaller --onefile --clean "
        f"--paths \"{build_path}\" "
        f"server.py"
    )
    
    run_command(pyinstaller_cmd, "compilar server.py com PyInstaller")

    # 3. Mover o arquivo compilado para a raiz e limpar
    exe_source = os.path.join("dist", "server.exe")
    exe_dest = "server.exe"

    if os.path.exists(exe_source):
        if os.path.exists(exe_dest):
            print("[+] Removendo executável antigo da raiz...")
            os.remove(exe_dest)
        
        print(f"[+] Movendo '{exe_source}' para '{exe_dest}'...")
        shutil.move(exe_source, exe_dest)

        # Copia para a pasta public do React para download web
        public_dest = os.path.join("public", "server.exe")
        if os.path.exists(public_dest):
            print("[+] Removendo executável antigo da pasta public...")
            os.remove(public_dest)
        print(f"[+] Copiando executável para '{public_dest}' para disponibilizar download...")
        shutil.copy2(exe_dest, public_dest)
        
        # 4. Gerar o arquivo ZIP para macOS
        import zipfile
        zip_dest = os.path.join("public", "robo_mac.zip")
        if os.path.exists(zip_dest):
            print("[+] Removendo zip antigo da pasta public...")
            os.remove(zip_dest)
        
        print(f"[+] Gerando pacote ZIP para macOS em '{zip_dest}'...")
        files_to_zip = [
            ("server.py", "server.py"),
            ("iniciar_mac.command", "iniciar_mac.command"),
            ("compilar_mac.command", "compilar_mac.command"),
            ("COMO_USAR_NO_MAC.txt", "COMO_USAR_NO_MAC.txt")
        ]
        
        try:
            with zipfile.ZipFile(zip_dest, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # Add single files
                for src, dest in files_to_zip:
                    if os.path.exists(src):
                        zipf.write(src, dest)
                
                # Add GUI_ADD folder (excluding unused subfolders of the Instagram export)
                for root, dirs, files in os.walk("GUI_ADD"):
                    # Check if this is an Instagram backup subdirectory
                    if "instagram-thenperson" in root:
                        rel_root = os.path.relpath(root, "GUI_ADD")
                        parts = rel_root.split(os.sep)
                        if len(parts) > 1:
                            allowed = False
                            if parts[1] == "media":
                                allowed = True
                            elif parts[1] == "logged_information":
                                if len(parts) > 2 and parts[2] == "past_instagram_insights":
                                    allowed = True
                                elif len(parts) == 2:
                                    allowed = True
                            
                            if not allowed:
                                continue
                    
                    for file in files:
                        file_path = os.path.join(root, file)
                        # Relativize path for the zip archive
                        rel_path = os.path.relpath(file_path, os.getcwd())
                        zipf.write(file_path, rel_path)
            print("[+] Pacote macOS 'robo_mac.zip' gerado com sucesso!")
        except Exception as e:
            print(f"[-] Erro ao gerar pacote macOS ZIP: {e}")

        # Limpeza
        print("[+] Limpando pastas temporárias de compilação...")
        if os.path.exists("build"):
            shutil.rmtree("build")
        if os.path.exists("dist"):
            shutil.rmtree("dist")
        if os.path.exists("server.spec"):
            os.remove("server.spec")
            
        print("\n==================================================")
        print(" [OK] SUCESSO! O executavel 'server.exe' foi gerado.")
        print(" Coloque-o junto da pasta 'GUI_ADD' e execute-o.")
        print("==================================================")
    else:
        print("[-] Erro: O executável compilado não foi encontrado na pasta 'dist'.")
        sys.exit(1)

if __name__ == "__main__":
    main()
