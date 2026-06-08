import React, { useState, useEffect, useRef } from 'react';
import { fetchFollowers, fetchBotStatus, startBot, stopBot, fetchSavedAccounts, addSavedAccount, deleteSavedAccount } from '../utils/api';
import { Send, Play, Square, Users, AlertCircle, Terminal, Plus, Trash2, Filter, RotateCw, Download, Heart, Share2, Save, Upload, Settings } from 'lucide-react';

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
  const [sendMode, setSendMode] = useState<'sequential' | 'parallel'>('sequential');
  const [triggerAction, setTriggerAction] = useState<'message' | 'follow' | 'both'>('message');

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

  // Impulsionamento de Postagem
  const [postUrl, setPostUrl] = useState('');
  const [postLike, setPostLike] = useState(true);
  const [postShare, setPostShare] = useState(false);
  const [postMinDelay, setPostMinDelay] = useState(5);
  const [postMaxDelay, setPostMaxDelay] = useState(15);
  const [postRotateEvery, setPostRotateEvery] = useState(1);

  // Gemini AI
  const [useGemini, setUseGemini] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    try {
      return localStorage.getItem('gemini_api_key') || '';
    } catch {
      return '';
    }
  });
  const [geminiPrompt, setGeminiPrompt] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('gemini_api_key', geminiApiKey);
    } catch (e) {
      console.warn('Could not save gemini_api_key to localStorage:', e);
    }
  }, [geminiApiKey]);

  const terminalRef = useRef<HTMLDivElement>(null);

  // Configurações do Modal de Exportar Campanha
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [includeAccounts, setIncludeAccounts] = useState(true);
  const [includeGeminiKey, setIncludeGeminiKey] = useState(false);
  const [includePostUrl, setIncludePostUrl] = useState(true);
  const [includeLeads, setIncludeLeads] = useState(true);
  const [activeTab, setActiveTab] = useState<'directs' | 'follow' | 'posts' | 'accounts' | 'config'>('directs');
  const [exportCampaignType, setExportCampaignType] = useState<'messages' | 'post_action' | 'follow'>('messages');

  // Importar Campanha (.json)
  const handleImportCampaign = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const camp = JSON.parse(e.target?.result as string);
        if (!camp) return;

        if (Array.isArray(camp.accounts)) {
          setAccounts(camp.accounts);
          try {
            localStorage.setItem('broadcast_accounts', JSON.stringify(camp.accounts));
          } catch (err) {
            console.warn(err);
          }
        }

        // Detecta e ajusta aba conforme o tipo de campanha importado
        const type = camp.campaign_type;
        if (type === 'messages') {
          setActiveTab('directs');
          if (typeof camp.action === 'string') setTriggerAction(camp.action);
        } else if (type === 'follow') {
          setActiveTab('follow');
          setTriggerAction('follow');
        } else if (type === 'post_action') {
          setActiveTab('posts');
          if (typeof camp.like === 'boolean') setPostLike(camp.like);
          if (typeof camp.share === 'boolean') setPostShare(camp.share);
          if (typeof camp.post_min_delay === 'number') setPostMinDelay(camp.post_min_delay);
          else if (typeof camp.min_delay === 'number') setPostMinDelay(camp.min_delay);
          
          if (typeof camp.post_max_delay === 'number') setPostMaxDelay(camp.post_max_delay);
          else if (typeof camp.max_delay === 'number') setPostMaxDelay(camp.max_delay);
          
          if (typeof camp.post_rotate_every === 'number') setPostRotateEvery(camp.post_rotate_every);
          else if (typeof camp.rotate_every === 'number') setPostRotateEvery(camp.rotate_every);
        }

        if (typeof camp.message === 'string') setMessage(camp.message);
        if (typeof camp.min_delay === 'number') setMinDelay(camp.min_delay);
        if (typeof camp.max_delay === 'number') setMaxDelay(camp.max_delay);
        if (typeof camp.rotate_every === 'number') setRotateEvery(camp.rotate_every);
        if (typeof camp.action === 'string') setTriggerAction(camp.action);
        if (typeof camp.use_gemini === 'boolean') setUseGemini(camp.use_gemini);
        if (typeof camp.gemini_api_key === 'string') setGeminiApiKey(camp.gemini_api_key);
        if (typeof camp.gemini_prompt === 'string') setGeminiPrompt(camp.gemini_prompt);
        if (typeof camp.post_url === 'string') setPostUrl(camp.post_url);
        if (typeof camp.like === 'boolean') setPostLike(camp.like);
        if (typeof camp.share === 'boolean') setPostShare(camp.share);
        if (typeof camp.post_min_delay === 'number') setPostMinDelay(camp.post_min_delay);
        if (typeof camp.post_max_delay === 'number') setPostMaxDelay(camp.post_max_delay);
        if (typeof camp.post_rotate_every === 'number') setPostRotateEvery(camp.post_rotate_every);
        if (typeof camp.send_mode === 'string') setSendMode(camp.send_mode);

        if (Array.isArray(camp.leads)) {
          setManualLeads(camp.leads.join(', '));
        }

        alert('Campanha carregada com sucesso no painel!');
      } catch (err: any) {
        alert(`Erro ao ler arquivo de campanha: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Exportar Campanha (.json)
  const handleExportCampaign = () => {
    const parsedManual = manualLeads.split(',').map(l => l.trim()).filter(l => l);
    const allLeads = Array.from(new Set([...selectedLeads, ...parsedManual]));

    const campData: any = {
      campaign_type: exportCampaignType,
      accounts: includeAccounts ? accounts : []
    };

    if (exportCampaignType === 'messages') {
      campData.message = message;
      campData.min_delay = minDelay;
      campData.max_delay = maxDelay;
      campData.rotate_every = rotateEvery;
      campData.action = triggerAction === 'follow' ? 'message' : triggerAction;
      campData.use_gemini = useGemini;
      campData.gemini_api_key = includeGeminiKey ? geminiApiKey : "";
      campData.gemini_prompt = geminiPrompt;
      campData.send_mode = sendMode;
      campData.leads = includeLeads ? allLeads : [];
    } else if (exportCampaignType === 'follow') {
      campData.min_delay = minDelay;
      campData.max_delay = maxDelay;
      campData.rotate_every = rotateEvery;
      campData.action = 'follow';
      campData.leads = includeLeads ? allLeads : [];
    } else if (exportCampaignType === 'post_action') {
      campData.post_url = includePostUrl ? postUrl : "";
      campData.like = postLike;
      campData.share = postShare;
      campData.min_delay = postMinDelay;
      campData.max_delay = postMaxDelay;
      campData.rotate_every = postRotateEvery;
      campData.use_gemini = useGemini;
      campData.gemini_api_key = includeGeminiKey ? geminiApiKey : "";
      campData.gemini_prompt = geminiPrompt;
      campData.leads = includeLeads ? allLeads : [];
    }

    const blob = new Blob([JSON.stringify(campData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campanha_${exportCampaignType}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowSaveModal(false);
  };

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
        if (config.sendMode) {
          setSendMode(config.sendMode);
        }
        if (config.triggerAction) {
          setTriggerAction(config.triggerAction);
        }
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

  // Scroll automático do log de terminal (Apenas o container interno, sem mover a página toda)
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
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

  const handleImportAccountsFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      
      const newAccs: any[] = [];
      for (const line of lines) {
        const parts = line.split(/[,:]/);
        if (parts.length >= 2) {
          const user = parts[0].trim().replace('@', '');
          const pass = parts[1].trim();
          if (user && pass && !accounts.some(acc => acc.username.toLowerCase() === user.toLowerCase()) && !newAccs.some(acc => acc.username.toLowerCase() === user.toLowerCase())) {
            newAccs.push({ username: user, password: pass });
          }
        }
      }

      if (newAccs.length > 0) {
        try {
          for (const acc of newAccs) {
            await addSavedAccount(acc);
          }
          setAccounts(prev => [...prev, ...newAccs.map(acc => ({ username: acc.username, password: '' }))]);
          alert(`✅ ${newAccs.length} contas importadas com sucesso!`);
        } catch (err) {
          console.warn('Erro ao salvar contas no servidor, salvando localmente:', err);
          setAccounts(prev => [...prev, ...newAccs]);
          alert(`✅ ${newAccs.length} contas importadas localmente!`);
        }
      } else {
        alert('Nenhuma conta nova encontrada no arquivo. Use o formato "usuario,senha" (uma conta por linha).');
      }
    };
    reader.readAsText(file);
  };

  const handleImportLeadsFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const names = text.split(/[\n,]/).map(n => n.trim().replace('@', '')).filter(n => n);
      if (names.length > 0) {
        setManualLeads(prev => {
          const current = prev.split(',').map(l => l.trim()).filter(l => l);
          const merged = Array.from(new Set([...current, ...names]));
          return merged.join(', ');
        });
        alert(`✅ ${names.length} destinatários carregados no campo manual!`);
      } else {
        alert('Nenhum destinatário encontrado no arquivo.');
      }
    };
    reader.readAsText(file);
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

    if (triggerAction !== 'follow' && !useGemini && !message) {
      alert('Por favor, preencha o texto da mensagem!');
      return;
    }

    if (useGemini && (!geminiApiKey || !geminiPrompt)) {
      alert('Por favor, preencha a API Key do Gemini e a Instrução da IA!');
      return;
    }

    if (allLeads.length === 0) {
      alert('Por favor, selecione ao menos um destinatário!');
      return;
    }

    // Salvar configuração atual localmente com tratamento de erro
    try {
      localStorage.setItem('broadcast_config', JSON.stringify({
        message,
        minDelay,
        maxDelay,
        rotateEvery,
        sendMode,
        triggerAction
      }));
    } catch (e) {
      console.warn('Could not save config to localStorage:', e);
    }

    try {
      setBotState(prev => ({ 
        ...prev, 
        status: 'running', 
        logs: prev?.logs ? [...prev.logs, `Iniciando robô (Modo: ${sendMode === 'parallel' ? 'paralelo' : 'sequencial'}, Ação: ${triggerAction}${useGemini ? ', com Gemini IA' : ''})...`] : [`Iniciando robô (Modo: ${sendMode === 'parallel' ? 'paralelo' : 'sequencial'}, Ação: ${triggerAction}${useGemini ? ', com Gemini IA' : ''})...`] 
      }));
      
      await startBot({
        accounts: activeAccounts,
        rotate_every: rotateEvery,
        message,
        leads: allLeads,
        min_delay: minDelay,
        max_delay: maxDelay,
        mode: sendMode,
        action: triggerAction,
        gemini_api_key: useGemini ? geminiApiKey : undefined,
        gemini_prompt: useGemini ? geminiPrompt : undefined
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

  const handlePostActionStart = async () => {
    if (accounts.length === 0) {
      alert('Por favor, adicione pelo menos uma conta do Instagram para realizar a ação!');
      return;
    }
    if (!postUrl) {
      alert('Por favor, insira o link da publicação!');
      return;
    }
    if (!postLike && !postShare) {
      alert('Selecione pelo menos uma ação (Curtir ou Compartilhar)!');
      return;
    }

    // Coleta leads manuais
    const parsedManual = manualLeads.split(',').map(l => l.trim()).filter(l => l);
    // Junta com seguidores selecionados
    const allLeads = Array.from(new Set([...selectedLeads, ...parsedManual]));

    if (postShare && allLeads.length === 0) {
      alert('Por favor, selecione ao menos um destinatário para o compartilhamento!');
      return;
    }

    if (postShare && useGemini && (!geminiApiKey || !geminiPrompt)) {
      alert('Por favor, preencha a API Key do Gemini e a Instrução da IA!');
      return;
    }

    try {
      setBotState(prev => ({ 
        ...prev, 
        status: 'running', 
        logs: prev?.logs ? [...prev.logs, `Iniciando impulsionamento do post (Curtir: ${postLike ? 'Sim' : 'Não'}, Compartilhar: ${postShare ? 'Sim' : 'Não'}${postShare && useGemini ? ', com Gemini IA' : ''})...`] : [`Iniciando impulsionamento do post (Curtir: ${postLike ? 'Sim' : 'Não'}, Compartilhar: ${postShare ? 'Sim' : 'Não'}${postShare && useGemini ? ', com Gemini IA' : ''})...`] 
      }));

      const res = await fetch(`${localStorage.getItem('api_base_url') || 'http://localhost:5000'}/api/bot/post-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': localStorage.getItem('api_token') || ''
        },
        body: JSON.stringify({
          accounts: accounts,
          post_url: postUrl,
          like: postLike,
          share: postShare,
          leads: allLeads,
          min_delay: postMinDelay,
          max_delay: postMaxDelay,
          rotate_every: postRotateEvery,
          gemini_api_key: (postShare && useGemini) ? geminiApiKey : undefined,
          gemini_prompt: (postShare && useGemini) ? geminiPrompt : undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao iniciar');
      }

      setBotState(prev => ({ ...prev, status: 'running' }));
    } catch (err: any) {
      alert(`Erro ao iniciar impulsionamento: ${err.message}`);
      setBotState(prev => ({ ...prev, status: 'idle' }));
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
              {botStatus === 'offline' ? 'Robô Desconectado (Abra o robô no computador)' :
               botStatus === 'running' ? 'Conectado • Executando disparos' :
               botStatus === 'stopping' ? 'Conectado • Parando disparos' :
               'Robô Conectado (Pronto para disparar)'}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2.5 rounded-xl transition-all shadow-sm hover:shadow cursor-pointer">
            <Upload size={16} />
            Carregar Campanha (.json)
            <input
              type="file"
              accept=".json"
              onChange={handleImportCampaign}
              className="hidden"
            />
          </label>
          <button
            onClick={() => {
              if (activeTab === 'directs') setExportCampaignType('messages');
              else if (activeTab === 'follow') setExportCampaignType('follow');
              else if (activeTab === 'posts') setExportCampaignType('post_action');
              setShowSaveModal(true);
            }}
            className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-4 py-2.5 rounded-xl transition-all shadow-sm hover:shadow"
          >
            <Save size={16} />
            Salvar Campanha (.json)
          </button>
          <a
            href="/server.exe"
            download="server.exe"
            className="flex items-center gap-2 text-sm font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 px-4 py-2.5 rounded-xl transition-all shadow-sm hover:shadow"
          >
            <Download size={16} />
            Baixar para Windows (.exe)
          </a>
        </div>
      </div>

      {/* Menu de Abas da Campanha */}
      <div className="flex flex-wrap border-b border-gray-200 gap-6 mb-6">
        <button
          onClick={() => {
            setActiveTab('directs');
            if (triggerAction === 'follow') setTriggerAction('message');
          }}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === 'directs' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          ✉️ Disparo de Directs
        </button>
        <button
          onClick={() => {
            setActiveTab('follow');
            setTriggerAction('follow');
          }}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === 'follow' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          👤 Seguir Perfis
        </button>
        <button
          onClick={() => setActiveTab('posts')}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === 'posts' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          🚀 Impulsionar Posts
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === 'accounts' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          👥 Contas do Instagram
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === 'config' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          ⚙️ Conexão & API
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Coluna da Esquerda: Configurações da Aba Ativa */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* ABA: CONTAS DO INSTAGRAM */}
          {activeTab === 'accounts' && (
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
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-bold text-gray-600">Adicionar Nova Conta do Instagram</p>
                    <label className="text-xs text-purple-600 font-bold hover:underline cursor-pointer flex items-center gap-1">
                      <Upload size={12} />
                      Carregar Lista de Contas (txt/csv)
                      <input
                        type="file"
                        accept=".txt,.csv"
                        onChange={handleImportAccountsFile}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Nome do Usuário (@exemplo)"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                    <input
                      type="password"
                      placeholder="Senha do Instagram"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Plus size={14} />
                      Adicionar
                    </button>
                  </div>
                </form>
              )}

              {/* Lista de Contas */}
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {accounts.map((acc, index) => (
                  <div key={index} className="flex items-center justify-between p-3.5 bg-gray-50/50 hover:bg-gray-50 rounded-xl border border-gray-100 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-xs font-bold">
                        @{acc.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-gray-700 block">@{acc.username}</span>
                        <span className="text-[10px] text-gray-400">Instagram Conectado</span>
                      </div>
                    </div>
                    {!isRunning && (
                      <button
                        onClick={() => handleRemoveAccount(index)}
                        className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remover Conta"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}

                {accounts.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm italic">
                    Nenhuma conta cadastrada. Adicione uma conta acima para iniciar!
                  </div>
                )}
              </div>

              {/* Configuração de Rotação */}
              <div className="border-t border-gray-100 pt-4">
                {sendMode === 'sequential' ? (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Rotacionar a cada</label>
                    <input
                      type="number"
                      min="1"
                      disabled={isRunning}
                      value={rotateEvery}
                      onChange={(e) => setRotateEvery(Math.max(1, Number(e.target.value)))}
                      className="w-16 px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs text-center focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60 font-semibold"
                    />
                    <label className="text-xs text-gray-700">envio(s)</label>
                  </div>
                ) : (
                  <div className="bg-green-50/50 p-4 rounded-xl border border-green-100/30 text-green-800 text-xs leading-relaxed">
                    <p className="font-bold flex items-center gap-1.5 text-green-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                      Envio Paralelo Ativado:
                    </p>
                    <p className="mt-0.5 text-gray-600">Todas as {accounts.length} contas cadastradas enviarão mensagens ao mesmo tempo, dividindo a lista de destinatários. Isso aumentará a velocidade de disparo em até {accounts.length}x!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA: DISPARO DE DIRECTS */}
          {activeTab === 'directs' && (
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-purple-600 font-bold mb-2">
                <Send size={20} />
                <h3>Mensagem e Controle</h3>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Ação a Executar</label>
                <select
                  disabled={isRunning}
                  value={triggerAction}
                  onChange={(e) => setTriggerAction(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60 font-semibold text-gray-700"
                >
                  <option value="message">Enviar Apenas Mensagem no Direct</option>
                  <option value="both">Seguir e Enviar Mensagem</option>
                </select>
              </div>

              {triggerAction !== 'follow' && (
                <div className="border border-purple-100 p-4 rounded-xl bg-purple-50/20 space-y-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-purple-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useGemini}
                      disabled={isRunning}
                      onChange={(e) => setUseGemini(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    Personalizar mensagem com Inteligência Artificial (Gemini)
                  </label>

                  {useGemini && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                      <div className="md:col-span-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Gemini API Key</label>
                        <input
                          type="password"
                          placeholder="Cole sua API Key aqui..."
                          disabled={isRunning}
                          value={geminiApiKey}
                          onChange={(e) => setGeminiApiKey(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Instrução/Prompt para a IA (ex: "Seja amigável")</label>
                        <textarea
                          rows={2}
                          placeholder="Instrua o robô sobre como criar o texto de cada mensagem personalizada..."
                          disabled={isRunning}
                          value={geminiPrompt}
                          onChange={(e) => setGeminiPrompt(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {triggerAction !== 'follow' && !useGemini && (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Mensagem Padrão (Sem IA)</label>
                  <textarea
                    rows={4}
                    placeholder="Olá @username! Tudo bem? ..."
                    disabled={isRunning}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60 resize-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Use <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">@username</code> ou <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">@fullname</code> para personalizar dinamicamente.</p>
                </div>
              )}

              {/* Modo de Envio */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Modo de Distribuição</label>
                  <select
                    disabled={isRunning}
                    value={sendMode}
                    onChange={(e) => setSendMode(e.target.value as any)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60 font-semibold text-gray-700"
                  >
                    <option value="sequential">Rotativo (Uma conta de cada vez)</option>
                    <option value="parallel">Paralelo (Todas as contas juntas)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
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
          )}

          {/* ABA: SEGUIR PERFIS */}
          {activeTab === 'follow' && (
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-purple-600 font-bold mb-2">
                <Users size={20} />
                <h3>Seguimento de Perfis</h3>
              </div>
              
              <div className="bg-purple-50/50 p-4 rounded-xl space-y-2 text-purple-900 border border-purple-100 text-xs">
                <p className="font-semibold flex items-center gap-1">
                  <AlertCircle size={14} />
                  Campanha de Seguimento Ativa
                </p>
                <p className="text-purple-700 leading-relaxed">
                  As contas do Instagram selecionadas irão seguir cada perfil presente na <strong>Lista de Destinatários</strong> (coluna da direita).
                </p>
              </div>

              {/* Modo de Envio */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Modo de Distribuição</label>
                  <select
                    disabled={isRunning}
                    value={sendMode}
                    onChange={(e) => setSendMode(e.target.value as any)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60 font-semibold text-gray-700"
                  >
                    <option value="sequential">Rotativo (Uma conta de cada vez)</option>
                    <option value="parallel">Paralelo (Todas as contas juntas)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
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
                  <p className="mt-0.5 leading-relaxed">Rotacionar entre várias contas ajuda muito a diluir o volume de ações de seguir, porém manter delays seguros (como 60 a 120s) ainda é essencial para evitar bloqueios de ação pelo Instagram.</p>
                </div>
              </div>
            </div>
          )}

          {/* ABA: IMPULSIONAR POSTS */}
          {activeTab === 'posts' && (
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                <div className="flex items-center gap-2 text-purple-600 font-bold">
                  <Heart size={20} className={isRunning ? 'animate-pulse' : ''} />
                  <Share2 size={20} />
                  <h3>Impulsionamento de Postagem (Curtir & Compartilhar)</h3>
                </div>
                <span className="text-xs px-2.5 py-1 bg-purple-50 text-purple-600 rounded-full font-bold">
                  Ação em Massa
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Link da Publicação (Post ou Reel)</label>
                    <input
                      type="text"
                      placeholder="https://www.instagram.com/p/C-XYZ... ou https://www.instagram.com/reel/C-XYZ..."
                      disabled={isRunning}
                      value={postUrl}
                      onChange={(e) => setPostUrl(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60"
                    />
                  </div>

                  <div className="flex flex-wrap gap-6 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={postLike}
                        disabled={isRunning}
                        onChange={(e) => setPostLike(e.target.checked)}
                        className="rounded text-purple-600 focus:ring-purple-500"
                      />
                      Curtir Publicação (com todas as contas)
                    </label>

                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={postShare}
                        disabled={isRunning}
                        onChange={(e) => setPostShare(e.target.checked)}
                        className="rounded text-purple-600 focus:ring-purple-500"
                      />
                      Compartilhar no Direct (enviar para destinatários selecionados)
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Delay Mín (s)</label>
                      <input
                        type="number"
                        disabled={isRunning}
                        value={postMinDelay}
                        onChange={(e) => setPostMinDelay(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60 text-center font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Delay Máx (s)</label>
                      <input
                        type="number"
                        disabled={isRunning}
                        value={postMaxDelay}
                        onChange={(e) => setPostMaxDelay(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60 text-center font-semibold"
                      />
                    </div>
                  </div>

                  {postShare && (
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Rotacionar Conta a cada</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          disabled={isRunning}
                          value={postRotateEvery}
                          onChange={(e) => setPostRotateEvery(Math.max(1, Number(e.target.value)))}
                          className="w-16 px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs text-center focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60 font-semibold"
                        />
                        <span className="text-xs text-gray-500">compartilhamento(s)</span>
                      </div>
                    </div>
                  )}

                  {postShare && (
                    <div className="border border-purple-100 p-4 rounded-xl space-y-3 bg-purple-50/20 mt-3">
                      <label className="flex items-center gap-2 text-xs font-bold text-purple-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useGemini}
                          disabled={isRunning}
                          onChange={(e) => setUseGemini(e.target.checked)}
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                        Personalizar comentário do Direct com IA (Gemini)
                      </label>

                      {useGemini && (
                        <div className="space-y-3 pt-2">
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Gemini API Key</label>
                            <input
                              type="password"
                              placeholder="Cole sua API Key aqui..."
                              disabled={isRunning}
                              value={geminiApiKey}
                              onChange={(e) => setGeminiApiKey(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Instrução para a IA (ex: "Elogie o post")</label>
                            <textarea
                              rows={2}
                              placeholder="O Gemini irá gerar um texto único para acompanhar o compartilhamento."
                              disabled={isRunning}
                              value={geminiPrompt}
                              onChange={(e) => setGeminiPrompt(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-50">
                <button
                  type="button"
                  onClick={isRunning ? handleStop : handlePostActionStart}
                  disabled={botStatus === 'stopping'}
                  className={`font-bold px-6 py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors w-full sm:w-auto ${
                    isRunning
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20'
                  }`}
                >
                  {isRunning ? (
                    <>
                      <Square size={16} />
                      <span>PARAR EXECUÇÃO</span>
                    </>
                  ) : (
                    <>
                      <Heart size={16} />
                      <span>INICIAR IMPULSIONAMENTO</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ABA: CONEXÃO & API */}
          {activeTab === 'config' && (
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                <div className="flex items-center gap-2 text-purple-600 font-bold">
                  <Settings size={20} />
                  <h3>Configurações de Conexão e Pareamento API</h3>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                  botStatus === 'offline' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                }`}>
                  {botStatus === 'offline' ? 'Desconectado' : 'Conectado / Pareado'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                    Endereço do Servidor local (API URL)
                  </label>
                  <input
                    type="text"
                    placeholder="ex: http://localhost:5000"
                    value={apiUrl}
                    onChange={(e) => {
                      setApiUrl(e.target.value);
                      localStorage.setItem('api_base_url', e.target.value);
                    }}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                    Chave de Pareamento (API Token)
                  </label>
                  <input
                    type="password"
                    placeholder="Chave/token de segurança"
                    value={apiToken}
                    onChange={(e) => {
                      setApiToken(e.target.value);
                      localStorage.setItem('api_token', e.target.value);
                    }}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
              </div>

              <div className="bg-purple-50/50 p-4 rounded-xl space-y-3 text-purple-900 border border-purple-100">
                <h4 className="text-xs font-bold flex items-center gap-1.5">
                  <AlertCircle size={16} />
                  Dica de Pareamento & Conteúdo Inseguro (Mixed Content)
                </h4>
                <p className="text-xs leading-relaxed text-purple-700">
                  Como este painel é servido via <strong>HTTPS</strong> seguro, o seu navegador pode bloquear requisições diretas para o IP local do seu computador (HTTP) devido a políticas de segurança de conteúdo misto.
                </p>
                <div className="text-xs space-y-1.5 pl-4 text-purple-800">
                  <div>• <strong>Método Headless:</strong> Utilize o modo portátil (salvando o arquivo <code className="bg-purple-100/80 px-1 py-0.5 rounded font-mono text-[11px]">campanha.json</code> e rodando <code className="bg-purple-100/80 px-1 py-0.5 rounded font-mono text-[11px]">iniciar_campanha.bat</code>) para contornar totalmente o navegador.</div>
                  <div>• <strong>Ngrok Ativo:</strong> Inicie o Ngrok (<code className="bg-purple-100/80 px-1 py-0.5 rounded font-mono text-[11px]">ngrok http 5000</code>) antes do servidor para que ele gere conexões HTTPS seguras e o painel conecte automaticamente.</div>
                  <div>• <strong>Liberação Manual:</strong> Clique no cadeado na barra de endereço, vá em "Configurações do site" e altere a opção "Conteúdo inseguro" para "Permitir".</div>
                </div>
              </div>
              
              <div className="border-t border-gray-50 pt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    window.location.search = `?api_url=${encodeURIComponent(apiUrl)}&api_token=${encodeURIComponent(apiToken)}`;
                  }}
                  className="text-xs font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 px-4 py-2 rounded-xl transition-all"
                >
                  Forçar Pareamento na URL
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await fetch(`${apiUrl}/api/health`, {
                        headers: { 'X-API-Key': apiToken }
                      });
                      if (res.ok) {
                        alert('Conexão ativa! Servidor Python respondendo corretamente.');
                      } else {
                        alert('Servidor respondeu com erro. Verifique a chave de pareamento.');
                      }
                    } catch (err: any) {
                      alert(`Não foi possível conectar ao servidor: ${err.message}`);
                    }
                  }}
                  className="text-xs font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-xl transition-all"
                >
                  Testar Conexão Local
                </button>
              </div>
            </div>
          )}
          
        </div>

        {/* Coluna da Direita: Terminal & Destinatários */}
        <div className="space-y-6">
          
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
            <div ref={terminalRef} className="h-64 overflow-y-auto font-mono text-xs text-green-300 space-y-1.5 pr-2">
              {botLogs.map((log: string, idx: number) => (
                <div key={idx} className="leading-relaxed whitespace-pre-wrap">{log}</div>
              ))}
              {botLogs.length === 0 && (
                <div className="text-gray-500 italic">O console aguarda o início do processo...</div>
              )}
            </div>

            {/* Ações e Progresso */}
            <div className="border-t border-gray-800 pt-4 flex flex-col justify-between gap-4">
              <div className="w-full">
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
              
              <div className="flex gap-3 w-full">
                <button
                  onClick={
                    isRunning 
                      ? handleStop 
                      : activeTab === 'posts' 
                        ? handlePostActionStart 
                        : handleStart
                  }
                  disabled={botStatus === 'stopping'}
                  className={`w-full font-bold px-6 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors ${
                    isRunning 
                      ? 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-55' 
                      : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20'
                  }`}
                >
                  {isRunning ? (
                    <Square size={16} key="stop-icon" />
                  ) : activeTab === 'posts' ? (
                    <Heart size={16} key="heart-icon" />
                  ) : (
                    <Play size={16} key="start-icon" />
                  )}
                  {isRunning ? 'PARAR' : 
                    activeTab === 'posts' ? 'INICIAR IMPULSIONAMENTO' :
                    activeTab === 'follow' ? 'INICIAR SEGUIMENTOS' :
                    'INICIAR DISPARO DIRECT'
                  }
                </button>
              </div>
            </div>
          </div>

          {/* Seleção de Leads (Direita) */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[600px]">
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
                  <span className="text-xs font-bold text-gray-700">Filtros</span>
                  <button 
                    onClick={() => {
                      setGenderFilter('Todos');
                      setAgeFilter('Todos');
                      setCityFilter('Todas');
                      setFollowedBackFilter('Todos');
                    }}
                    className="text-[10px] text-purple-600 hover:underline font-bold"
                  >
                    Limpar Filtros
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-gray-500 block">Gênero</label>
                    <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} className="w-full bg-white border border-gray-200 rounded p-1">
                      <option>Todos</option>
                      <option>Masculino</option>
                      <option>Feminino</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block">Idade</label>
                    <select value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)} className="w-full bg-white border border-gray-200 rounded p-1">
                      <option>Todos</option>
                      <option>Jovem (&lt;25)</option>
                      <option>Adulto (25-45)</option>
                      <option>Sênior (&gt;45)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block">Cidade</label>
                    <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="w-full bg-white border border-gray-200 rounded p-1">
                      {citiesList.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block">Segue de volta?</label>
                    <select value={followedBackFilter} onChange={(e) => setFollowedBackFilter(e.target.value)} className="w-full bg-white border border-gray-200 rounded p-1">
                      <option>Todos</option>
                      <option>Sim</option>
                      <option>Não</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="relative mb-3">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Filter size={16} />
              </span>
              <input
                type="text"
                placeholder="Pesquisar seguidores..."
                disabled={isRunning}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div className="flex-1 overflow-y-auto mb-3 border border-gray-50 rounded-xl min-h-0 bg-gray-50/20">
              {loadingLeads ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2 py-8">
                  <RotateCw size={24} className="animate-spin text-purple-500" />
                  <span className="text-xs">Carregando base de seguidores...</span>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 p-2">
                  {filteredFollowers.map((follower) => (
                    <label key={follower.username} className="flex items-center gap-3 py-2 px-1 hover:bg-purple-50/20 rounded-lg cursor-pointer transition-colors text-xs">
                      <input
                        type="checkbox"
                        disabled={isRunning}
                        checked={selectedLeads.includes(follower.username)}
                        onChange={() => toggleLeadSelection(follower.username)}
                        className="rounded text-purple-600 focus:ring-purple-500"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-gray-700 block truncate">@{follower.username}</span>
                        {follower.full_name && (
                          <span className="text-[10px] text-gray-400 block truncate">{follower.full_name}</span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {follower.city && follower.city !== 'Outras' && (
                          <span className="text-[8px] bg-purple-50 text-purple-600 px-1 py-0.5 rounded block">{follower.city}</span>
                        )}
                        {follower.gender && (
                          <span className="text-[8px] text-gray-400 block mt-0.5">{follower.gender}</span>
                        )}
                      </div>
                    </label>
                  ))}
                  {filteredFollowers.length === 0 && (
                    <div className="text-center py-12 text-gray-400 text-xs italic">
                      Nenhum seguidor localizado com estes filtros.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Destinatários selecionados:</span>
                <span className="font-bold text-purple-600">
                  {Array.from(new Set([...selectedLeads, ...manualLeads.split(',').map(l => l.trim()).filter(l => l)])).length} usuário(s)
                </span>
              </div>

              <div className="flex justify-between gap-2">
                <button
                  type="button"
                  disabled={isRunning || loadingLeads}
                  onClick={selectAllFiltered}
                  className="flex-1 py-1.5 border border-purple-200 text-purple-600 hover:bg-purple-50 rounded-lg text-[10px] font-bold transition-all text-center"
                >
                  {filteredFollowers.every(f => selectedLeads.includes(f.username)) && filteredFollowers.length > 0
                    ? 'Desmarcar Filtro'
                    : 'Selecionar Filtro'}
                </button>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => setSelectedLeads([])}
                  className="py-1.5 px-3 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-lg text-[10px] font-bold transition-all"
                >
                  Limpar
                </button>
              </div>

              <div className="pt-2 border-t border-gray-50">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase block">Adicionar Arrobas Manualmente (opcional)</label>
                  <label className="text-[10px] text-purple-600 font-bold hover:underline cursor-pointer flex items-center gap-0.5">
                    <Upload size={10} />
                    Importar Leads
                    <input
                      type="file"
                      accept=".txt,.csv"
                      onChange={handleImportLeadsFile}
                      disabled={isRunning}
                      className="hidden"
                    />
                  </label>
                </div>
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
      </div>

      {/* Modal de Exportação de Campanha */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Save className="text-emerald-600" size={20} />
                Exportar Campanha Portátil
              </h3>
              <p className="text-gray-500 text-xs mt-1">
                Escolha quais informações deseja salvar no arquivo <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-[11px]">campanha.json</code>.
                Variáveis não incluídas serão perguntadas no terminal ao iniciar o servidor portátil.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                Tipo de Campanha a Exportar
              </label>
              <select
                value={exportCampaignType}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setExportCampaignType(val);
                  if (val === 'follow') {
                    setIncludePostUrl(false);
                    setIncludeGeminiKey(false);
                  } else if (val === 'messages') {
                    setIncludePostUrl(false);
                  } else if (val === 'post_action') {
                    setIncludePostUrl(true);
                  }
                }}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="messages">✉️ Enviar Mensagens (Directs)</option>
                <option value="post_action">🚀 Impulsionar Post (Curtir & Compartilhar)</option>
                <option value="follow">👤 Apenas Seguir Perfis</option>
              </select>
            </div>

            <div className="space-y-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100 text-sm">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeAccounts}
                  onChange={(e) => setIncludeAccounts(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-semibold text-gray-700 block text-xs">Incluir Contas do Instagram</span>
                  <span className="text-gray-500 text-[11px] block">Salva as contas e senhas atuais para evitar digitação.</span>
                </div>
              </label>

              {(exportCampaignType === 'messages' || exportCampaignType === 'post_action') && (
                <label className="flex items-start gap-3 cursor-pointer select-none border-t border-gray-100 pt-3">
                  <input
                    type="checkbox"
                    checked={includeGeminiKey}
                    onChange={(e) => setIncludeGeminiKey(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-semibold text-gray-700 block text-xs">Incluir Chave API do Gemini</span>
                    <span className="text-gray-500 text-[11px] block">Desmarque para digitar a chave no terminal de forma mais segura.</span>
                  </div>
                </label>
              )}

              {exportCampaignType === 'post_action' && (
                <label className="flex items-start gap-3 cursor-pointer select-none border-t border-gray-100 pt-3">
                  <input
                    type="checkbox"
                    checked={includePostUrl}
                    onChange={(e) => setIncludePostUrl(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-semibold text-gray-700 block text-xs">Incluir Link da Publicação</span>
                    <span className="text-gray-500 text-[11px] block">Desmarque se a publicação ainda não foi postada (será perguntada ao rodar).</span>
                  </div>
                </label>
              )}

              <label className="flex items-start gap-3 cursor-pointer select-none border-t border-gray-100 pt-3">
                <input
                  type="checkbox"
                  checked={includeLeads}
                  onChange={(e) => setIncludeLeads(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-semibold text-gray-700 block text-xs">Incluir Lista de Destinatários</span>
                  <span className="text-gray-500 text-[11px] block">Salva os leads atuais no arquivo de campanha.</span>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExportCampaign}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5"
              >
                <Download size={14} />
                Baixar campanha.json
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Broadcast;
