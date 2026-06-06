import sys
import os

# Adiciona o diretório atual ao path para garantir que os imports funcionem
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from gui import InstagramGUI
import tkinter as tk

def main():
    root = tk.Tk()
    app = InstagramGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()
