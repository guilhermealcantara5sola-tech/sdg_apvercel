import React, { useState, useEffect, useRef } from 'react';
import { fetchFollowers, fetchBotStatus, startBot, stopBot } from '../utils/api';
import { Send, Play, Square, Users, Settings, AlertCircle, Terminal, Check } from 'lucide-react';

const Broadcast: React.FC = () => {
  // Credenciais e Configs
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [minDelay, setMinDelay] = useState(60);
  const [maxDelay, setMaxDelay] = useState(120);
  const [manualLeads, setManualLeads] = useState('');

  // Status e Logs
  const [botState, setBotState] = useState<any>({
    status: 'idle',
    progress: { current: 0, total: 0, current_user: '' },
    logs: []
  });

  // Leads do arquivo (seguidores do instagram)
  const [followers, setFollowers] = useState<any[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingLeads, setLoadingLeads] = useState(true);

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
        setUsername(config.username || '');
        setMessage(config.message || '');
        setMinDelay(config.minDelay || 60);
        setMaxDelay(config.maxDelay || 120);
      }
    } catch (e) {
      console.warn('Could not read config from localStorage:', e);
    }
  }, []);

  // Poll do status do bot quando rodando
  useEffect(() => {
    let interval: any = null;

    async function checkStatus() {
      const statusData = await fetchBotStatus();
      setBotState(statusData);
      
      if (!statusData || statusData.status === 'idle' || statusData.status === 'completed' || statusData.status === 'error') {
        if (interval) clearInterval(interval);
      }
    }

    checkStatus();

    // Se estiver rodando ou parando, atualiza a cada 2 segundos
    const currentStatus = botState?.status || 'idle';
    if (currentStatus === 'running' || currentStatus === 'stopping') {
      interval = setInterval(checkStatus, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [botState?.status]);

  // Scroll automático do log de terminal
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [botState?.logs]);

  // Filtrar lista de seguidores
  const filteredFollowers = followers.filter(f => 
    f.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    // Coleta leads manuais
    const parsedManual = manualLeads.split(',').map(l => l.trim()).filter(l => l);
    // Junta com seguidores selecionados
    const allLeads = Array.from(new Set([...selectedLeads, ...parsedManual]));

    if (!username || !password || !message || allLeads.length === 0) {
      alert('Por favor, preencha todos os campos e selecione ao menos um lead!');
      return;
    }

    // Salvar configuração atual localmente com tratamento de erro
    try {
      localStorage.setItem('broadcast_config', JSON.stringify({
        username,
        message,
        minDelay,
        maxDelay
      }));
    } catch (e) {
      console.warn('Could not save config to localStorage:', e);
    }

    try {
      setBotState(prev => ({ 
        ...prev, 
        status: 'running', 
        logs: prev?.logs ? [...prev.logs, 'Iniciando disparo...'] : ['Iniciando disparo...'] 
      }));
      await startBot({
        username,
        password,
        message,
        leads: allLeads,
        min_delay: minDelay,
        max_delay: maxDelay
      });
      // Inicia o polling setando status como running
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
  const botStatus = botState?.status || 'idle';
  const botProgress = botState?.progress || { current: 0, total: 0, current_user: '' };
  const botLogs = botState?.logs || [];
  const isRunning = botStatus === 'running' || botStatus === 'stopping';
  const progressPercent = botProgress.total > 0 
    ? Math.round((botProgress.current / botProgress.total) * 100) 
    : 0;


  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Disparo de Mensagens</h2>
        <p className="text-gray-500">Envie mensagens automatizadas em massa para sua base de leads com segurança.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Painel de Configurações */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Sessão de Login */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-purple-600 font-bold mb-2">
              <Settings size={20} />
              <h3>Acesso ao Instagram</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Usuário</label>
                <input
                  type="text"
                  placeholder="@seu_usuario"
                  disabled={isRunning}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Senha</label>
                <input
                  type="password"
                  placeholder="Sua senha do Instagram"
                  disabled={isRunning}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60"
                />
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
                placeholder="Olá @username! Vi que você acompanha nossa campanha do Thenperson... (Use com moderação)"
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
                <p className="font-bold">Aviso sobre Delays:</p>
                <p className="mt-0.5 leading-relaxed">O Instagram impõe limites estritos de DMs por dia. Delays longos (mínimo de 60-120 segundos) ajudam a evitar bloqueios temporários ou suspensão da conta.</p>
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
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[600px]">
          <div className="flex items-center gap-2 text-purple-600 font-bold mb-4">
            <Users size={20} />
            <h3>Lista de Destinatários</h3>
          </div>

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
            <span className="text-xs font-bold text-gray-400 uppercase">
              {selectedLeads.length} selecionados
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
                    <span>@{follower.username}</span>
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                      isSel ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300 bg-white'
                    }`}>
                      {isSel && <Check size={14} />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-gray-400">
                Nenhum seguidor encontrado
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
