import React, { useState, useEffect, useRef } from 'react';
import { fetchFollowers, fetchBotStatus, startBot, stopBot, fetchSavedAccounts, addSavedAccount, deleteSavedAccount } from '../utils/api';
import { Send, Play, Square, Users, AlertCircle, Terminal, Check, Plus, Trash2, Filter, RotateCw, Download } from 'lucide-react';

interface BotState {
  status: string;
  progress: {
    current: number;
    total: number;
    current_user: string;
  };
  logs: string[];
}

const Broadcast: React.FC = () => {
  // Contas do Instagram para disparo
  const [accounts, setAccounts] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('broadcast_accounts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [rotateEvery, setRotateEvery] = useState(1);
  
  // URL do Servidor de Automação
  const [apiUrl, setApiUrl] = useState(() => {
    return localStorage.getItem('api_base_url') || 'http://localhost:5000';
  });

  // Token de Pareamento da API do Robô
  const [apiToken, setApiToken] = useState(() => {
    return localStorage.getItem('api_token') || '';
  });

  // Configurações de envio
  const [message, setMessage] = useState('');
  const [minDelay, setMinDelay] = useState(60);
  const [maxDelay, setMaxDelay] = useState(120);
  const [manualLeads, setManualLeads] = useState('');

  // Status e Logs
  const [botState, setBotState] = useState<BotState>({
    status: 'offline',
    progress: { current: 0, total: 0, current_user: '' },
    logs: []
  });

  // Leads do arquivo (seguidores do instagram)
  const [followers, setFollowers] = useState<any[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingLeads, setLoadingLeads] = useState(true);

  // Filtros
  const [showFilters, setShowFilters] = useState(false);
  const [genderFilter, setGenderFilter] = useState('Todos');
  const [ageFilter, setAgeFilter] = useState('Todos');
  const [cityFilter, setCityFilter] = useState('Todas');
  const [followedBackFilter, setFollowedBackFilter] = useState('Todos');

  const logEndRef = useRef<HTMLDivElement>(null);

  // Carregar seguidores reais
  useEffect(() => {
    async function loadFollowers() {
      try {
        const data = await fetchFollowers();
        setFollowers(data.followers || []);
      } catch (err) {
        console.error('Error loading followers:', err);
      } finally {
        setLoadingLeads(false);
      }
    }
    loadFollowers();
    
    // Carregar configurações salvas anteriormente (se houver) com tratamento de erro
    try {
      const savedConfig = localStorage.getItem('broadcast_config');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        setMessage(config.message || '');
        setMinDelay(config.minDelay || 60);
        setMaxDelay(config.maxDelay || 120);
        setRotateEvery(config.rotateEvery || 1);
      }
    } catch (e) {
      console.warn('Could not read config from localStorage:', e);
    }
  }, []);

  // Verificar se há parâmetros de pareamento na URL (ao acessar via QR Code)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlParam = params.get('api_url');
      const tokenParam = params.get('api_token');
      
      if (urlParam || tokenParam) {
        if (urlParam) {
          setApiUrl(urlParam);
          localStorage.setItem('api_base_url', urlParam);
        }
        if (tokenParam) {
          setApiToken(tokenParam);
          localStorage.setItem('api_token', tokenParam);
        }
        
        // Limpa os parâmetros da barra de endereços para ficar limpo
        window.history.replaceState({}, document.title, window.location.pathname);
        alert('📱 Conexão estabelecida! Aparelho pareado com sucesso.');
      }
    } catch (err) {
      console.error('Error parsing pairing query params:', err);
    }
  }, []);



  // Carregar contas do computador ao montar ou mudar dados da conexão
  useEffect(() => {
    async function loadAccountsFromServer() {
      try {
        const data = await fetchSavedAccounts();
        if (Array.isArray(data)) {
          setAccounts(data.map((acc: any) => ({ username: acc.username, password: '' })));
        }
      } catch (err) {
        console.warn('Could not fetch accounts from backend, using local storage:', err);
        try {
          const saved = localStorage.getItem('broadcast_accounts');
          if (saved) setAccounts(JSON.parse(saved));
        } catch {}
      }
    }
    loadAccountsFromServer();
  }, [apiUrl, apiToken]);

  // Salvar contas localmente sempre que alteradas (como backup local)
  useEffect(() => {
    localStorage.setItem('broadcast_accounts', JSON.stringify(accounts));
  }, [accounts]);

  // Poll do status do bot a cada 3 segundos de forma contínua para atualizar logs e conexões
  useEffect(() => {
    async function checkStatus() {
      try {
        const statusData = await fetchBotStatus();
        setBotState(statusData);
      } catch (err) {
        setBotState({
          status: 'offline',
          progress: { current: 0, total: 0, current_user: '' },
          logs: ['[SISTEMA] Backend offline. Conecte o servidor Python local para usar o robô de disparo.']
        });
      }
    }

    checkStatus();

    const interval = setInterval(checkStatus, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [apiUrl, apiToken]);

  // Scroll automático do log de terminal
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [botState?.logs]);

  // Adicionar conta de disparo
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword) return;
    
    const user = newUsername.trim().replace('@', '');
    if (accounts.some(acc => acc.username.toLowerCase() === user.toLowerCase())) {
      alert('Esta conta já está adicionada!');
      return;
    }

    try {
      await addSavedAccount({ username: user, password: newPassword });
      setAccounts(prev => [...prev, { username: user, password: '' }]);
      setNewUsername('');
      setNewPassword('');
    } catch (err: any) {
      console.warn('Failed to save account on server, saving locally as fallback:', err);
      setAccounts(prev => [...prev, { username: user, password: newPassword }]);
      setNewUsername('');
      setNewPassword('');
    }
  };

  // Remover conta de disparo
  const handleRemoveAccount = async (index: number) => {
    const accountToRemove = accounts[index];
    try {
      await deleteSavedAccount(accountToRemove.username);
    } catch (err) {
      console.warn('Failed to delete account from server:', err);
    }
    setAccounts(prev => prev.filter((_, idx) => idx !== index));
  };

  // Filtrar lista de seguidores
  const filteredFollowers = followers.filter(f => {
    const matchesSearch = f.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGender = genderFilter === 'Todos' || f.gender === genderFilter;
    const matchesAge = ageFilter === 'Todos' || f.age_group === ageFilter;
    const matchesCity = cityFilter === 'Todas' || f.city === cityFilter;
    
    let matchesFollowedBack = true;
    if (followedBackFilter === 'Sim') {
      matchesFollowedBack = f.followed_back === true;
    } else if (followedBackFilter === 'Não') {
      matchesFollowedBack = f.followed_back === false;
    }
    
    return matchesSearch && matchesGender && matchesAge && matchesCity && matchesFollowedBack;
  });

  const toggleLeadSelection = (user: string) => {
    setSelectedLeads(prev => 
      prev.includes(user) ? prev.filter(u => u !== user) : [...prev, user]
    );
  };

  const selectAllFiltered = () => {
    const usernames = filteredFollowers.map(f => f.username);
    setSelectedLeads(prev => {
      const otherSelected = prev.filter(u => !usernames.includes(u));
      // Se todos os filtrados já estão selecionados, desseleciona eles
      const allSelected = usernames.every(u => prev.includes(u));
      if (allSelected) {
        return otherSelected;
      } else {
        return [...otherSelected, ...usernames];
      }
    });
  };

  const handleStart = async () => {
    let activeAccounts = [...accounts];
    
    // Se o usuário preencheu os inputs mas esqueceu de clicar em adicionar, adiciona automaticamente
    if (activeAccounts.length === 0 && newUsername && newPassword) {
      const acc = { username: newUsername.trim().replace('@', ''), password: newPassword };
      activeAccounts = [acc];
      setAccounts([acc]);
      setNewUsername('');
      setNewPassword('');
    }

    // Coleta leads manuais
    const parsedManual = manualLeads.split(',').map(l => l.trim()).filter(l => l);
    // Junta com seguidores selecionados
    const allLeads = Array.from(new Set([...selectedLeads, ...parsedManual]));

    if (activeAccounts.length === 0) {
      alert('Por favor, adicione pelo menos uma conta do Instagram para realizar os disparos!');
      return;
    }

    if (!message || allLeads.length === 0) {
      alert('Por favor, preencha o texto da mensagem e selecione ao menos um destinatário!');
      return;
    }

    // Salvar configuração atual localmente com tratamento de erro
    try {
      localStorage.setItem('broadcast_config', JSON.stringify({
        message,
        minDelay,
        maxDelay,
        rotateEvery
      }));
    } catch (e) {
      console.warn('Could not save config to localStorage:', e);
    }

    try {
      setBotState(prev => ({ 
        ...prev, 
        status: 'running', 
        logs: prev?.logs ? [...prev.logs, 'Iniciando disparador com rotatividade...'] : ['Iniciando disparador com rotatividade...'] 
      }));
      
      await startBot({
        accounts: activeAccounts,
        rotate_every: rotateEvery,
        message,
        leads: allLeads,
        min_delay: minDelay,
        max_delay: maxDelay
      });
      
      // Inicia o polling
      setBotState(prev => ({ ...prev, status: 'running' }));
    } catch (err: any) {
      alert(`Erro ao iniciar robô: ${err.message}`);
      setBotState(prev => ({ ...prev, status: 'idle' }));
    }
  };

  const handleStop = async () => {
    try {
      await stopBot();
      setBotState(prev => ({ ...prev, status: 'stopping' }));
    } catch (err: any) {
      alert(`Erro ao parar robô: ${err.message}`);
    }
  };

  // Variaveis de status seguras contra undefined
  const botStatus = botState?.status || 'offline';
  const botProgress = botState?.progress || { current: 0, total: 0, current_user: '' };
  const botLogs = botState?.logs || [];
  const isRunning = botStatus === 'running' || botStatus === 'stopping';
  const progressPercent = botProgress.total > 0 
    ? Math.round((botProgress.current / botProgress.total) * 100) 
    : 0;

  // Lista de cidades para o filtro
  const citiesList = ['Todas', 'Almenara', 'Belo Horizonte', 'Araçuaí', 'Rubim', 'Jacinto', 'Outras'];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Disparo de Mensagens</h2>
          <p className="text-gray-500 text-sm">Envie mensagens automatizadas em massa com rotatividade de contas e filtros avançados.</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              botStatus === 'running' ? 'bg-green-500 animate-pulse' :
              botStatus === 'stopping' ? 'bg-amber-500 animate-pulse' :
              botStatus === 'offline' ? 'bg-red-500 animate-pulse' : 'bg-green-500'
            }`}></span>
            <span className="text-xs text-gray-500 font-semibold">
              {botStatus === 'offline' ? 'Robô Desconectado (Abra o server.exe no PC)' :
               botStatus === 'running' ? 'Conectado • Executando disparos' :
               botStatus === 'stopping' ? 'Conectado • Parando disparos' :
               'Robô Conectado (Pronto para disparar)'}
            </span>
          </div>
        </div>
        <a
          href="/server.exe"
          download="server.exe"
          className="flex items-center gap-2 text-sm font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 px-4 py-2.5 rounded-xl transition-all"
        >
          <Download size={16} />
          Baixar Robô para Windows (.exe)
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Painel de Configurações */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Sessão de Contas Rotativas */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-gray-50 pb-3">
              <div className="flex items-center gap-2 text-purple-600 font-bold">
                <RotateCw size={20} className={isRunning ? 'animate-spin' : ''} />
                <h3>Contas de Disparo (Rotatividade)</h3>
              </div>
              <span className="text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded-full font-bold">
                {accounts.length} conta(s) cadastradas
              </span>
            </div>

            {/* Form de Adição */}
            {!isRunning && (
              <form onSubmit={handleAddAccount} className="bg-gray-50/50 p-4 rounded-xl space-y-3 border border-gray-100">
                <p className="text-xs font-bold text-gray-600">Adicionar Nova Conta do Instagram</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <input
                      type="text"
                      placeholder="Usuário (@conta)"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Senha"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                    <button
                      type="submit"
                      className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg text-sm flex items-center justify-center transition-colors shrink-0"
                      title="Adicionar Conta"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Lista de Contas Cadastradas */}
            <div className="space-y-2">
              {accounts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {accounts.map((acc, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-sm font-semibold text-gray-700">@{acc.username}</span>
                      </div>
                      {!isRunning && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAccount(index)}
                          className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remover Conta"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
                  Nenhuma conta cadastrada. Preencha os dados no formulário acima.
                </div>
              )}
            </div>

            {/* Controle de Rotatividade */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-purple-50/40 p-4 rounded-xl border border-purple-100/30">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-purple-700 block">Frequência de Rotação</span>
                <span className="text-xs text-gray-500">Troca a conta de disparo automaticamente após enviar um número de DMs.</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-700">Mudar conta a cada</label>
                <input
                  type="number"
                  min="1"
                  disabled={isRunning}
                  value={rotateEvery}
                  onChange={(e) => setRotateEvery(Math.max(1, Number(e.target.value)))}
                  className="w-16 px-2 py-1 bg-white border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60 font-semibold"
                />
                <label className="text-xs text-gray-700">envio(s)</label>
              </div>
            </div>
          </div>

          {/* Mensagem e Delays */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-purple-600 font-bold mb-2">
              <Send size={20} />
              <h3>Mensagem e Controle</h3>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Texto da Mensagem</label>
              <textarea
                rows={4}
                placeholder="Olá @username! Vi que você acompanha nosso perfil... (Use com moderação)"
                disabled={isRunning}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60 resize-y"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Delay Mínimo (segundos)</label>
                <input
                  type="number"
                  disabled={isRunning}
                  value={minDelay}
                  onChange={(e) => setMinDelay(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Delay Máximo (segundos)</label>
                <input
                  type="number"
                  disabled={isRunning}
                  value={maxDelay}
                  onChange={(e) => setMaxDelay(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60"
                />
              </div>
            </div>
            <div className="bg-amber-50 p-4 rounded-xl flex gap-3 text-amber-800 text-xs mt-4">
              <AlertCircle size={20} className="flex-shrink-0" />
              <div>
                <p className="font-bold">Dica de Segurança:</p>
                <p className="mt-0.5 leading-relaxed">Rotacionar entre várias contas ajuda muito a diluir o volume de disparos, porém manter delays seguros (como 60 a 120s) ainda é essencial para a saúde das contas.</p>
              </div>
            </div>
          </div>

          {/* Logs / Console em Tempo Real */}
          <div className="bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2 text-green-400 font-mono text-sm">
                <Terminal size={18} />
                <span>Atividade do Console</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  botStatus === 'running' ? 'bg-green-500 animate-pulse' :
                  botStatus === 'stopping' ? 'bg-amber-500 animate-pulse' : 'bg-gray-600'
                }`}></span>
                <span className="text-xs text-gray-400 uppercase font-mono">{botStatus}</span>
              </div>
            </div>
            
            {/* Terminal View */}
            <div className="h-64 overflow-y-auto font-mono text-xs text-green-300 space-y-1.5 pr-2">
              {botLogs.map((log: string, idx: number) => (
                <div key={idx} className="leading-relaxed whitespace-pre-wrap">{log}</div>
              ))}
              {botLogs.length === 0 && (
                <div className="text-gray-500 italic">O console aguarda o início do processo...</div>
              )}
              <div ref={logEndRef} />
            </div>

            {/* Ações e Progresso */}
            <div className="border-t border-gray-800 pt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex-1 w-full">
                {isRunning && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-400 font-mono">
                      <span>Progresso: {botProgress.current}/{botProgress.total}</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div className="bg-purple-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                    {botProgress.current_user && (
                      <p className="text-[10px] text-gray-400 font-mono">Processando @{botProgress.current_user}...</p>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  onClick={isRunning ? handleStop : handleStart}
                  disabled={botStatus === 'stopping'}
                  className={`flex-1 sm:flex-none font-bold px-6 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors ${
                    isRunning 
                      ? 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-55' 
                      : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20'
                  }`}
                >
                  {isRunning ? (
                    <Square size={16} key="stop-icon" />
                  ) : (
                    <Play size={16} key="start-icon" />
                  )}
                  {isRunning ? 'PARAR' : 'INICIAR DISPARO'}
                </button>
              </div>
            </div>
          </div>
        </div>


        {/* Seleção de Leads (Direita) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[760px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-purple-600 font-bold">
              <Users size={20} />
              <h3>Lista de Destinatários</h3>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              disabled={isRunning}
              className={`p-2 rounded-lg border transition-all ${
                showFilters || genderFilter !== 'Todos' || ageFilter !== 'Todos' || cityFilter !== 'Todas' || followedBackFilter !== 'Todos'
                  ? 'bg-purple-50 border-purple-200 text-purple-600'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
              title="Filtros Demográficos"
            >
              <Filter size={18} />
            </button>
          </div>

          {/* Painel de Filtros Demográficos */}
          {showFilters && (
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-3 space-y-3 animate-fadeIn">
              <div className="flex justify-between items-center border-b border-gray-200 pb-1">
                <span className="text-xs font-bold text-gray-600">Filtros Demográficos</span>
                <button 
                  onClick={() => {
                    setGenderFilter('Todos');
                    setAgeFilter('Todos');
                    setCityFilter('Todas');
                    setFollowedBackFilter('Todos');
                  }}
                  className="text-[10px] text-purple-600 font-bold hover:underline"
                >
                  Limpar Filtros
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Gênero</label>
                  <select
                    value={genderFilter}
                    onChange={(e) => setGenderFilter(e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-gray-200 rounded text-xs focus:outline-none"
                  >
                    <option value="Todos">Todos</option>
                    <option value="Mulheres">Mulheres</option>
                    <option value="Homens">Homens</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Idade</label>
                  <select
                    value={ageFilter}
                    onChange={(e) => setAgeFilter(e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-gray-200 rounded text-xs focus:outline-none"
                  >
                    <option value="Todos">Todos</option>
                    <option value="Criança">Criança (13-17)</option>
                    <option value="Jovem">Jovem (18-24)</option>
                    <option value="Adulto">Adulto (25-54)</option>
                    <option value="Idoso">Idoso (55+)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Cidade</label>
                  <select
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-gray-200 rounded text-xs focus:outline-none"
                  >
                    {citiesList.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Segue de Volta?</label>
                  <select
                    value={followedBackFilter}
                    onChange={(e) => setFollowedBackFilter(e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-gray-200 rounded text-xs focus:outline-none"
                  >
                    <option value="Todos">Todos</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Busca */}
          <input
            type="text"
            placeholder="Pesquisar seguidor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={isRunning}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 mb-3 disabled:opacity-60"
          />

          {/* Selecionar Todos */}
          <div className="flex justify-between items-center mb-3">
            <span className="text-[11px] font-bold text-gray-400 uppercase">
              {filteredFollowers.length} filtrados • {selectedLeads.length} selecionados
            </span>
            <button
              onClick={selectAllFiltered}
              disabled={isRunning}
              className="text-xs text-purple-600 font-bold hover:underline disabled:opacity-60"
            >
              Marcar/Desmarcar Filtrados
            </button>
          </div>

          {/* Lista de Seguidores */}
          <div className="flex-1 overflow-y-auto space-y-1.5 border border-gray-50 rounded-xl p-2 bg-gray-50/20 mb-4">
            {loadingLeads ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600"></div>
              </div>
            ) : filteredFollowers.length > 0 ? (
              filteredFollowers.map((follower) => {
                const isSel = selectedLeads.includes(follower.username);
                return (
                  <button
                    key={follower.username}
                    disabled={isRunning}
                    onClick={() => toggleLeadSelection(follower.username)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-sm text-left transition-all ${
                      isSel 
                        ? 'bg-purple-50/50 border-purple-200 text-purple-700 font-medium' 
                        : 'bg-white border-gray-100 text-gray-700 hover:bg-gray-50'
                    } disabled:opacity-75 disabled:cursor-not-allowed`}
                  >
                    <div className="flex flex-col space-y-0.5">
                      <span className="font-semibold">@{follower.username}</span>
                      <span className="text-[10px] text-gray-400">
                        {follower.gender === 'Mulheres' ? 'Feminino' : 'Masculino'} • {follower.age_group} • {follower.city}
                      </span>
                    </div>
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                      isSel ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300 bg-white'
                    } shrink-0`}>
                      {isSel && <Check size={14} />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-gray-400">
                Nenhum seguidor corresponde aos critérios
              </div>
            )}
          </div>

          {/* Entrada Manual de Leads */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase block">Adicionar Leads Manuais (vírgula)</label>
            <input
              type="text"
              placeholder="ex: neymarjr, casimiro, @anitta"
              disabled={isRunning}
              value={manualLeads}
              onChange={(e) => setManualLeads(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Broadcast;
