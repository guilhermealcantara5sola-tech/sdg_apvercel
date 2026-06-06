# Instagram DM Automation Tool (Versão GUI)

Esta ferramenta permite o envio automatizado de mensagens diretas (DMs) para uma lista de usuários do Instagram através de uma interface gráfica simples e intuitiva.

## ⚠️ AVISO IMPORTANTE

**O uso desta ferramenta viola os Termos de Serviço do Instagram.** Existe um risco real de suspensão ou banimento da conta. Use com moderação e por sua conta e risco.

### Dicas de Segurança:
- Não envie centenas de mensagens por dia. Comece com 5-10 e aumente gradualmente.
- Utilize delays longos (recomenda-se entre 60 e 120 segundos).
- Use uma conta secundária para testes antes de usar sua conta principal.

## Instalação

1.  Certifique-se de ter o Python 3.8+ instalado.
2.  Instale as dependências necessárias:
    ```bash
    pip install -r requirements.txt
    ```

## Como Usar

1.  Execute o arquivo principal:
    ```bash
    python main.py
    ```
2.  Na janela que abrir:
    - Digite seu **usuário** e **senha** do Instagram.
    - Digite a **mensagem** que deseja enviar.
    - Configure os **delays** (tempo de espera entre cada envio).
    - Clique em **"Carregar Arquivo"** para selecionar sua lista de arrobas (pode ser um arquivo `.txt` com uma arroba por linha ou um arquivo `.json`).
    - Clique em **"INICIAR DISPARO"**.

## Funcionalidades
- **Interface Gráfica**: Não precisa mais editar arquivos de configuração manualmente.
- **Multithreading**: A interface não trava enquanto o robô está trabalhando.
- **Logs em Tempo Real**: Veja exatamente o que o robô está fazendo através da caixa de log na tela.
- **Persistência**: O programa lembra seu último usuário e mensagem para facilitar o próximo uso.
- **Interrupção Segura**: Você pode clicar em "PARAR" a qualquer momento para interromper o envio.
