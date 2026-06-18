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
    print("  Compilador do Servidor do Criador - Thenperson")
    print("==================================================")

    # 1. Compilar usando PyInstaller
    pyinstaller_cmd = (
        f"pyinstaller --onefile --clean "
        f"creator_server.py"
    )
    
    run_command(pyinstaller_cmd, "compilar creator_server.py com PyInstaller")

    # 2. Mover o arquivo compilado para a raiz e limpar
    exe_source = os.path.join("dist", "creator_server.exe")
    exe_dest = "creator_server.exe"

    if os.path.exists(exe_source):
        if os.path.exists(exe_dest):
            print("[+] Removendo executável antigo da raiz...")
            os.remove(exe_dest)
        
        print(f"[+] Movendo '{exe_source}' para '{exe_dest}'...")
        shutil.move(exe_source, exe_dest)

        # Copia para a pasta public do React para download web
        public_dest = os.path.join("public", "creator_server.exe")
        if os.path.exists(public_dest):
            print("[+] Removendo executável antigo da pasta public...")
            os.remove(public_dest)
        print(f"[+] Copiando executável para '{public_dest}' para disponibilizar download...")
        shutil.copy2(exe_dest, public_dest)

        # Limpeza
        print("[+] Limpando pastas temporárias de compilação...")
        if os.path.exists("build"):
            shutil.rmtree("build")
        if os.path.exists("dist"):
            shutil.rmtree("dist")
        if os.path.exists("creator_server.spec"):
            os.remove("creator_server.spec")
            
        print("\n==================================================")
        print(" [OK] SUCESSO! O executavel 'creator_server.exe' foi gerado.")
        print(" Execute-o para rodar o servidor de criacao na porta 5001.")
        print("==================================================")
    else:
        print("[-] Erro: O executável compilado não foi encontrado na pasta 'dist'.")
        sys.exit(1)

if __name__ == "__main__":
    main()
