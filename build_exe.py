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
    
    dependencies = ["pyinstaller", "flask", "flask-cors", "instagrapi"]
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
            print("[+] Removendo executável antigo...")
            os.remove(exe_dest)
        
        print(f"[+] Movendo '{exe_source}' para '{exe_dest}'...")
        shutil.move(exe_source, exe_dest)
        
        # Limpeza
        print("[+] Limpando pastas temporárias de compilação...")
        if os.path.exists("build"):
            shutil.rmtree("build")
        if os.path.exists("dist"):
            shutil.rmtree("dist")
        if os.path.exists("server.spec"):
            os.remove("server.spec")
            
        print("\n==================================================")
        print(" 🎉 SUCESSO! O executável 'server.exe' foi gerado.")
        print(" Coloque-o junto da pasta 'GUI_ADD' e execute-o.")
        print("==================================================")
    else:
        print("[-] Erro: O executável compilado não foi encontrado na pasta 'dist'.")
        sys.exit(1)

if __name__ == "__main__":
    main()
