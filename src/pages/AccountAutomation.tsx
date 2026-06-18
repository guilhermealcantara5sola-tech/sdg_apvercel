import React, { useState, useEffect, useRef } from 'react';
import { 
  fetchSavedAccounts, 
  deleteSavedAccount, 
  verifySavedAccount, 
  postMedia, 
  startBot, 
  stopBot, 
  fetchBotStatus, 
  fetchFollowers,
  createAccounts,
  fetchSettings,
  fetchFullAccounts,
  fetchCreatorStatus,
  stopCreator
} from '../utils/api';
import { 
  UserPlus, 
  Cpu, 
  MessageSquare, 
  Image as ImageIcon, 
  Play, 
  Square, 
  Trash2, 
  Terminal, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Upload, 
  FileAudio,
  Sparkles,
  Search,
  Download,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';


interface Account {
  username: string;
  status: 'pending' | 'verified' | 'failed';
  errorMsg?: string;
}

const AccountAutomation: React.FC = () => {
  // Navigation Tabs
  const [activeTab, rawSetActiveTab] = useState<'accounts' | 'boosting' | 'posts' | 'create_accounts'>(
    () => (localStorage.getItem('active_tab') as any) || 'accounts'
  );

  const setActiveTab = (tab: 'accounts' | 'boosting' | 'posts' | 'create_accounts') => {
    rawSetActiveTab(tab);
    localStorage.setItem('active_tab', tab);
  };

  // Copy feedback state
  const [copiedUser, setCopiedUser] = useState<string | null>(null);

  // 4. Tab Criar Contas
  const [smsKey, setSmsKey] = useState(() => localStorage.getItem('sms_activate_key') || '');
  const [country, setCountry] = useState('brazil'); 
  const [usernamePrefix, setUsernamePrefix] = useState('sdg');
  const [createPassword, setCreatePassword] = useState('');
  const [createProxy, setCreateProxy] = useState('');
  const [createCount, setCreateCount] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [fullAccounts, setFullAccounts] = useState<{ username: string, password?: string }[]>([]);
  const [fullAccountsError, setFullAccountsError] = useState<string | null>(null);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [consoleMode, setConsoleMode] = useState<'unified' | 'bot' | 'creator'>('unified');
  const [copiedConsole, setCopiedConsole] = useState(false);
  const [creatorStatus, setCreatorStatus] = useState('idle');
  const [creatorLogs, setCreatorLogs] = useState<string[]>([]);
  const [creatorProgress, setCreatorProgress] = useState({ current: 0, total: 0, current_user: '' });

  // Connection settings
  const [apiUrl] = useState(() => localStorage.getItem('api_base_url') || 'http://localhost:5000');
  const [apiToken] = useState(() => localStorage.getItem('api_token') || '');

  // 1. Tab Gerenciar Contas
  const [savedAccounts, setSavedAccounts] = useState<Account[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // 2. Tab Impulsionamento
  const [selectedSenderAccounts, setSelectedSenderAccounts] = useState<string[]>([]);
  const [leadsSource, setLeadsSource] = useState<'manual' | 'followers'>('manual');
  const [manualLeads, setManualLeads] = useState('');
  const [systemLeads, setSystemLeads] = useState<any[]>([]);
  const [selectedSystemLeads, setSelectedSystemLeads] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [messageTemplate, setMessageTemplate] = useState('Olá! Te achei aqui no Instagram e adorei seu perfil. Me segue de volta para acompanhar meus conteúdos e compartilhe com seus amigos se curtir! TMJ!');
  const [audioFilename, setAudioFilename] = useState('');
  const [audioUploadPath, setAudioUploadPath] = useState('');
  const [uploadingAudio, setUploadingAudio] = useState(false);
  
  const [boostingAction, setBoostingAction] = useState<'message' | 'follow' | 'both'>('both');
  const [minDelay, setMinDelay] = useState(30);
  const [maxDelay, setMaxDelay] = useState(60);
  const [rotateEvery, setRotateEvery] = useState(1);
  const [campaignLogs, setCampaignLogs] = useState<string[]>([]);
  const [botStatus, setBotStatus] = useState('idle');
  const [botProgress, setBotProgress] = useState({ current: 0, total: 0, current_user: '' });

  // 3. Tab Postagens Automáticas
  const [postAccounts, setPostAccounts] = useState<string[]>([]);
  const [postImage, setPostImage] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState<string>('');
  const [postCaption, setPostCaption] = useState('Conteúdo diário para aquecer a conta! 🚀 #instagram #marketingdigital #automacao');
  const [postingStatus, setPostingStatus] = useState<string>('');
  const [isPosting, setIsPosting] = useState(false);

  // Combina e ordena os logs pelo timestamp [HH:MM:SS]
  const getUnifiedLogs = () => {
    const formattedBotLogs = campaignLogs.map(log => {
      const str = typeof log === 'string' ? log : JSON.stringify(log);
      return str.includes('[ROBÔ]') || str.includes('[SISTEMA]') ? str : `[ROBÔ] ${str}`;
    });
    const formattedCreatorLogs = creatorLogs.map(log => {
      const str = typeof log === 'string' ? log : JSON.stringify(log);
      return str.includes('[CRIADOR]') || str.includes('[SISTEMA]') ? str : `[CRIADOR] ${str}`;
    });
    const allLogs = [...formattedBotLogs, ...formattedCreatorLogs];
    return allLogs.sort((a, b) => {
      const timeA = a.match(/\[(\d{2}:\d{2}:\d{2})\]/)?.[1] || '';
      const timeB = b.match(/\[(\d{2}:\d{2}:\d{2})\]/)?.[1] || '';
      if (timeA && timeB) {
        return timeA.localeCompare(timeB);
      }
      return 0;
    });
  };

  const handleCopyConsole = () => {
    const logs = 
      consoleMode === 'unified' 
        ? getUnifiedLogs() 
        : consoleMode === 'creator' 
        ? creatorLogs 
        : campaignLogs;
    if (logs.length === 0) return;
    const textToCopy = logs.join('\n');
    navigator.clipboard.writeText(textToCopy);
    setCopiedConsole(true);
    setTimeout(() => setCopiedConsole(false), 2000);
  };

  // Context-aware sidebar variables based on active tab (Port 5000 vs 5001)
  const currentStatus = activeTab === 'create_accounts' ? creatorStatus : botStatus;
  const currentProgress = activeTab === 'create_accounts' ? creatorProgress : botProgress;
  const currentLogs = 
    consoleMode === 'unified' 
      ? getUnifiedLogs() 
      : consoleMode === 'creator' 
      ? creatorLogs 
      : campaignLogs;

  const logEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  
  // Fetch Saved Accounts & System Leads
  const loadAccounts = async () => {
    try {
      setAccountsError(null);
      const data = await fetchSavedAccounts();
      if (Array.isArray(data)) {
        const accountsList = data
          .filter((acc: any) => acc && typeof acc.username === 'string' && acc.username.trim() !== '')
          .map((acc: any) => ({
            username: acc.username,
            status: 'pending' as const
          }));
        setSavedAccounts(accountsList);
      } else {
        setSavedAccounts([]);
        setAccountsError(data?.error || data?.message || 'Resposta inesperada do servidor principal.');
      }
    } catch (err: any) {
      console.error('Error fetching accounts:', err);
      setSavedAccounts([]);
      setAccountsError(err.message || 'Falha na conexão com o servidor do robô (porta 5000). Certifique-se de que o backend principal está rodando.');
    }
  };

  const loadSystemLeads = async () => {
    try {
      const data = await fetchFollowers();
      if (data && data.followers) {
        setSystemLeads(data.followers);
      }
    } catch (err) {
      console.error('Error fetching system leads:', err);
    }
  };

  const loadSettingsFromServer = async () => {
    try {
      const data = await fetchSettings();
      if (data) {
        if (data.sms_activate_key) setSmsKey(data.sms_activate_key);
        if (data.country) setCountry(data.country);
        if (data.username_prefix) setUsernamePrefix(data.username_prefix);
        if (data.proxy) setCreateProxy(data.proxy);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const loadFullAccounts = async () => {
    try {
      setFullAccountsError(null);
      const data = await fetchFullAccounts();
      if (Array.isArray(data)) {
        const validFullAccounts = data.filter((acc: any) => acc && typeof acc.username === 'string' && acc.username.trim() !== '');
        setFullAccounts(validFullAccounts);
      } else {
        setFullAccounts([]);
        setFullAccountsError(data?.error || data?.message || 'Resposta inesperada do servidor de criação.');
      }
    } catch (err: any) {
      console.error('Error fetching full accounts:', err);
      setFullAccounts([]);
      setFullAccountsError(err.message || 'Falha na conexão com o servidor do criador (porta 5001). Verifique se o creator_server está rodando.');
    }
  };

  useEffect(() => {
    loadAccounts();
    loadSystemLeads();
    loadSettingsFromServer();
    loadFullAccounts();

    // Sincroniza estados iniciais dos dois servidores (disparo na porta 5000 e criador na 5001)
    const checkInitialStatuses = async () => {
      try {
        const botState = await fetchBotStatus();
        setBotStatus(botState.status);
        setBotProgress(botState.progress);
        if (botState.logs) setCampaignLogs(botState.logs);
      } catch (e) {}
      
      try {
        const creatorState = await fetchCreatorStatus();
        setCreatorStatus(creatorState.status);
        setCreatorProgress(creatorState.progress);
        if (creatorState.logs) setCreatorLogs(creatorState.logs);
      } catch (e) {}
    };
    checkInitialStatuses();
  }, []);

  // Poll Bot Status when campaign is running (Port 5000)
  useEffect(() => {
    let timer: any;
    const checkStatus = async () => {
      try {
        const state = await fetchBotStatus();
        const prevStatus = botStatus;
        setBotStatus(state.status);
        setBotProgress(state.progress);
        if (state.logs) {
          setCampaignLogs(state.logs);
        }

        // Se terminou ou parou, atualiza a lista de contas na mesma hora
        if (state.status !== 'running' && state.status !== 'stopping' && prevStatus === 'running') {
          loadAccounts();
          loadFullAccounts();
        }
        
        if (state.status === 'running' || state.status === 'stopping') {
          timer = setTimeout(checkStatus, 3000);
        }
      } catch (err) {
        console.error(err);
      }
    };

    if (botStatus === 'running' || botStatus === 'stopping') {
      checkStatus();
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [botStatus]);

  // Poll Creator Status when creation is running (Port 5001)
  useEffect(() => {
    let timer: any;
    const checkCreatorStatus = async () => {
      try {
        const state = await fetchCreatorStatus();
        const prevStatus = creatorStatus;
        setCreatorStatus(state.status);
        setCreatorProgress(state.progress);
        if (state.logs) {
          setCreatorLogs(state.logs);
        }

        // Se terminou ou parou, atualiza a lista de contas na mesma hora
        if (state.status !== 'running' && state.status !== 'stopping' && prevStatus === 'running') {
          loadAccounts();
          loadFullAccounts();
        }
        
        if (state.status === 'running' || state.status === 'stopping') {
          timer = setTimeout(checkCreatorStatus, 3000);
        }
      } catch (err) {
        console.error(err);
      }
    };

    if (creatorStatus === 'running' || creatorStatus === 'stopping') {
      checkCreatorStatus();
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [creatorStatus]);

  // Scroll to logs end inside the terminal container only, without shifting the whole page
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [currentLogs]);

  // Account creation/testing function
  const handleVerifyAndAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword) return;

    setIsVerifying(true);
    setVerifyStatus(null);

    try {
      const res = await verifySavedAccount({
        username: newUsername,
        password: newPassword
      });
      setVerifyStatus({ type: 'success', message: res.message || 'Conta adicionada e conectada com sucesso!' });
      setNewUsername('');
      setNewPassword('');
      loadAccounts();
    } catch (err: any) {
      setVerifyStatus({ type: 'error', message: err.message || 'Erro ao conectar conta. Verifique usuário/senha ou proxy.' });
    } finally {
      setIsVerifying(false);
    }
  };

  // Run Test Verification on existing account
  const handleTestAccount = async (username: string) => {
    setSavedAccounts(prev => prev.map(acc => acc.username === username ? { ...acc, status: 'pending' } : acc));
    try {
      // Pedimos a senha ao usuário se não tivermos ou apenas deixamos em branco para a API usar a senha salva
      await verifySavedAccount({ username, password: '' });
      setSavedAccounts(prev => prev.map(acc => acc.username === username ? { ...acc, status: 'verified' } : acc));
    } catch (err: any) {
      setSavedAccounts(prev => prev.map(acc => acc.username === username ? { ...acc, status: 'failed', errorMsg: err.message } : acc));
    }
  };

  // Delete Account
  const handleDeleteAccount = async (username: string) => {
    if (!confirm(`Remover conta @${username}?`)) return;
    try {
      await deleteSavedAccount(username);
      loadAccounts();
    } catch (err) {
      alert('Erro ao excluir conta.');
    }
  };

  // Audio Upload Helper
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setAudioFilename(file.name);
    
    setUploadingAudio(true);
    const formData = new FormData();
    formData.append('audio', file);

    try {
      const res = await fetch(`${apiUrl}/api/upload-audio`, {
        method: 'POST',
        headers: apiToken ? { 'X-API-Key': apiToken } : {},
        body: formData
      });
      if (!res.ok) throw new Error('Falha no upload');
      const data = await res.json();
      setAudioUploadPath(data.path);
    } catch (err) {
      alert('Erro ao fazer upload do arquivo de áudio.');
    } finally {
      setUploadingAudio(false);
    }
  };

  // Toggle sender selection
  const toggleSenderAccount = (username: string) => {
    setSelectedSenderAccounts(prev => 
      prev.includes(username) ? prev.filter(u => u !== username) : [...prev, username]
    );
  };

  // Select all senders
  const selectAllSenders = () => {
    if (selectedSenderAccounts.length === savedAccounts.length) {
      setSelectedSenderAccounts([]);
    } else {
      setSelectedSenderAccounts(savedAccounts.map(a => a.username));
    }
  };

  // Toggle post account selection
  const togglePostAccount = (username: string) => {
    setPostAccounts(prev => 
      prev.includes(username) ? prev.filter(u => u !== username) : [...prev, username]
    );
  };

  // Select all post accounts
  const selectAllPostAccounts = () => {
    if (postAccounts.length === savedAccounts.length) {
      setPostAccounts([]);
    } else {
      setPostAccounts(savedAccounts.map(a => a.username));
    }
  };

  // Start Boosting Campaign
  const handleStartCampaign = async () => {
    if (selectedSenderAccounts.length === 0) {
      alert('Selecione pelo menos uma conta de disparo.');
      return;
    }

    let finalLeadsList: string[] = [];
    if (leadsSource === 'manual') {
      finalLeadsList = manualLeads.split('\n')
        .map(l => l.trim().replace('@', ''))
        .filter(l => l.length > 0);
    } else {
      finalLeadsList = selectedSystemLeads;
    }

    if (finalLeadsList.length === 0) {
      alert('Adicione pelo menos um contato de destino para impulsionar.');
      return;
    }

    setCampaignLogs(['[SISTEMA] Iniciando campanha...']);
    setBotStatus('running');

    try {
      await startBot({
        accounts: selectedSenderAccounts.map(username => ({ username })),
        message: messageTemplate,
        leads: finalLeadsList,
        min_delay: minDelay,
        max_delay: maxDelay,
        rotate_every: rotateEvery,
        action: boostingAction,
        audio_path: audioUploadPath || null
      });
    } catch (err: any) {
      alert(err.message || 'Erro ao iniciar campanha.');
      setBotStatus('idle');
    }
  };

  // Stop Boosting Campaign
  const handleStopCampaign = async () => {
    try {
      await stopBot();
      setBotStatus('stopping');
    } catch (err) {
      alert('Erro ao parar robô.');
    }
  };

  // Stop Creator Subprocess
  const handleStopCreator = async () => {
    try {
      await stopCreator();
      setCreatorStatus('stopping');
    } catch (err) {
      alert('Erro ao parar criador.');
    }
  };

  // Post image handler
  const handlePostImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setPostImage(file);
    setPostImagePreview(URL.createObjectURL(file));
  };

  // Execute Batch Posting
  const handlePublishPost = async () => {
    if (postAccounts.length === 0) {
      alert('Selecione pelo menos uma conta para postar.');
      return;
    }
    if (!postImage) {
      alert('Por favor, faça o upload de uma imagem.');
      return;
    }

    setIsPosting(true);
    setPostingStatus('Iniciando envio em lote...');
    setCampaignLogs(['[POSTAGEM] Preparando upload de mídia...']);
    setBotStatus('running');

    const formData = new FormData();
    formData.append('image', postImage);
    formData.append('caption', postCaption);
    formData.append('accounts', JSON.stringify(postAccounts));

    try {
      const res = await postMedia(formData);
      setPostingStatus(res.message || 'Postagem iniciada em segundo plano!');
    } catch (err: any) {
      alert(err.message || 'Erro ao agendar postagens.');
      setBotStatus('idle');
    } finally {
      setIsPosting(false);
    }
  };

  const handleCreateAccounts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (smsKey) {
      localStorage.setItem('sms_activate_key', smsKey);
    }
    setIsCreating(true);
    setCreatorLogs(['[SISTEMA] Iniciando criador de contas automático...']);
    setCreatorStatus('running');

    try {
      await createAccounts({
        sms_key: smsKey,
        country: country,
        username_prefix: usernamePrefix,
        password: createPassword,
        proxy: createProxy,
        count: createCount
      });
    } catch (err: any) {
      alert(err.message || 'Erro ao iniciar criação de contas.');
      setCreatorStatus('idle');
    } finally {
      setIsCreating(false);
    }
  };

  const handleExportTXT = () => {
    if (fullAccounts.length === 0) {
      alert('Nenhuma conta gerada/salva para exportar.');
      return;
    }
    const content = fullAccounts.map(acc => `${acc.username}:${acc.password || ''}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'contas_geradas.txt');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    if (fullAccounts.length === 0) {
      alert('Nenhuma conta gerada/salva para exportar.');
      return;
    }
    const dict: Record<string, string> = {};
    fullAccounts.forEach(acc => {
      dict[acc.username] = acc.password || '';
    });
    const content = JSON.stringify(dict, null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'contas_geradas.json');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUser(id);
    setTimeout(() => setCopiedUser(null), 2000);
  };

  // Filtering leads search
  const filteredSystemLeads = systemLeads.filter(lead => 
    lead.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header and description */}
      <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-6 text-zinc-100 shadow-xl relative overflow-hidden glow-border-purple">
        <div className="absolute right-0 top-0 opacity-5 transform translate-x-1/4 -translate-y-1/4 scale-150 text-purple-500">
          <Cpu size={250} />
        </div>
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-950/30 border border-purple-500/20 text-purple-300 rounded-full text-xs font-mono font-semibold backdrop-blur-md">
            <Terminal size={12} className="text-purple-400 animate-pulse" />
            <span>sys_op: active_session</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight font-mono text-zinc-100 flex items-center gap-2">
            <span className="text-purple-500">&gt;_</span> Painel de Automação de Contas
          </h1>
          <p className="text-zinc-400 max-w-2xl text-xs leading-relaxed">
            Interface para gerenciamento centralizado de múltiplos perfis no Instagram. Execute ações automatizadas de engajamento (seguir, envio de mensagens e áudio) e agendamento de posts em escala a partir de sessões simuladas e autenticadas.
          </p>
        </div>
      </div>

      {/* VS Code Editor File Tabs */}
      <div className="flex bg-[#121214] border border-[#2d2d34] overflow-x-auto select-none rounded-t-xl w-fit">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-2 text-xs flex items-center gap-2 border-r border-[#2d2d34] border-t-2 transition-all ${
            activeTab === 'accounts' 
              ? 'bg-[#1e1e24] text-purple-400 border-t-purple-500 font-semibold' 
              : 'bg-[#121214] text-zinc-500 border-t-transparent hover:text-zinc-300 hover:bg-[#1c1c1f]'
          }`}
        >
          <UserPlus size={13} className={activeTab === 'accounts' ? 'text-purple-400' : 'text-zinc-600'} />
          <span className="font-mono text-[11px]">connect_profiles.json</span>
        </button>
        <button
          onClick={() => setActiveTab('boosting')}
          className={`px-4 py-2 text-xs flex items-center gap-2 border-r border-[#2d2d34] border-t-2 transition-all ${
            activeTab === 'boosting' 
              ? 'bg-[#1e1e24] text-purple-400 border-t-purple-500 font-semibold' 
              : 'bg-[#121214] text-zinc-500 border-t-transparent hover:text-zinc-300 hover:bg-[#1c1c1f]'
          }`}
        >
          <Cpu size={13} className={activeTab === 'boosting' ? 'text-purple-400' : 'text-zinc-600'} />
          <span className="font-mono text-[11px]">campaign_config.json</span>
        </button>
        <button
          onClick={() => setActiveTab('posts')}
          className={`px-4 py-2 text-xs flex items-center gap-2 border-r border-[#2d2d34] border-t-2 transition-all ${
            activeTab === 'posts' 
              ? 'bg-[#1e1e24] text-purple-400 border-t-purple-500 font-semibold' 
              : 'bg-[#121214] text-zinc-500 border-t-transparent hover:text-zinc-300 hover:bg-[#1c1c1f]'
          }`}
        >
          <ImageIcon size={13} className={activeTab === 'posts' ? 'text-purple-400' : 'text-zinc-600'} />
          <span className="font-mono text-[11px]">media_uploader.json</span>
        </button>
        <button
          onClick={() => setActiveTab('create_accounts')}
          className={`px-4 py-2 text-xs flex items-center gap-2 border-r border-[#2d2d34] border-t-2 transition-all ${
            activeTab === 'create_accounts' 
              ? 'bg-[#1e1e24] text-purple-400 border-t-purple-500 font-semibold' 
              : 'bg-[#121214] text-zinc-500 border-t-transparent hover:text-zinc-300 hover:bg-[#1c1c1f]'
          }`}
        >
          <Sparkles size={13} className={activeTab === 'create_accounts' ? 'text-purple-400' : 'text-zinc-600'} />
          <span className="font-mono text-[11px]">account_creator.py</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left / Middle: Configuration Area (spans 2 columns) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* TAB 1: CONNECT & MANAGE ACCOUNTS */}
          {activeTab === 'accounts' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Conectar Novo Perfil</h2>
                <p className="text-gray-500 text-xs mt-1">
                  Adicione o usuário e a senha da sua conta de disparo do Instagram. A ferramenta criará uma sessão local segura para simular um celular real.
                </p>
              </div>

              <form onSubmit={handleVerifyAndAddAccount} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Usuário do Instagram (@)</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="ex: perfil_crescimento"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-55"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Senha</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-55"
                    required
                  />
                </div>

                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw className="animate-spin" size={16} />
                        Testando Login e Conectando...
                      </>
                    ) : (
                      <>
                        <UserPlus size={16} />
                        Conectar e Validar Conta
                      </>
                    )}
                  </button>
                </div>
              </form>

              {verifyStatus && (
                <div className={`p-4 rounded-xl flex items-start gap-3 border ${
                  verifyStatus.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {verifyStatus.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                  <span className="text-xs font-medium">{verifyStatus.message}</span>
                </div>
              )}

              <div className="border-t border-gray-100 pt-6 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-gray-800">Contas Conectadas ({savedAccounts.length})</h3>
                  <p className="text-gray-500 text-xs mt-0.5">
                    Essas contas estão salvas no banco de dados local e prontas para realizar ações automatizadas.
                  </p>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {accountsError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 mb-2 font-medium">
                      <XCircle size={14} className="text-rose-600 shrink-0" />
                      <span>{accountsError}</span>
                    </div>
                  )}
                  {savedAccounts.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-sm">
                      Nenhuma conta conectada no momento. Use o formulário acima para conectar.
                    </div>
                  ) : (
                    savedAccounts.map((acc) => (
                      <div key={acc.username} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm">
                            {(acc.username || '').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-gray-800 text-sm">@{acc.username}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {acc.status === 'pending' && (
                                <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-[10px] font-semibold">
                                  Não testada nesta sessão
                                </span>
                              )}
                              {acc.status === 'verified' && (
                                <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-semibold">
                                  Conectada & Válida
                                </span>
                              )}
                              {acc.status === 'failed' && (
                                <span className="inline-block px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full text-[10px] font-semibold" title={acc.errorMsg}>
                                  Erro na Conexão
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTestAccount(acc.username)}
                            className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Testar Conexão"
                          >
                            <RefreshCw size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteAccount(acc.username)}
                            className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Remover Conta"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BOOSTING (FOLLOW + DM/AUDIO) */}
          {activeTab === 'boosting' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Impulsionamento de Contas</h2>
                <p className="text-gray-500 text-xs mt-1">
                  Selecione suas contas emissoras e defina ações para seguir usuários alvos, enviar DMs de texto e áudio personalizado convidando-os para seguir e compartilhar.
                </p>
              </div>

              {/* 1. Selecionar contas emissoras */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700">Contas Emissoras (que farão as ações)</label>
                  <button 
                    onClick={selectAllSenders}
                    className="text-xs text-purple-600 font-semibold hover:underline"
                  >
                    {selectedSenderAccounts.length === savedAccounts.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1 border border-gray-200 rounded-lg bg-gray-50">
                  {savedAccounts.length === 0 ? (
                    <span className="text-xs text-gray-400 p-2">Nenhuma conta cadastrada. Conecte contas primeiro.</span>
                  ) : (
                    savedAccounts.map((acc) => (
                      <button
                        key={acc.username}
                        onClick={() => toggleSenderAccount(acc.username)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${
                          selectedSenderAccounts.includes(acc.username)
                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        @{acc.username}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* 2. Selecionar ação */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => setBoostingAction('follow')}
                  className={`p-3 border rounded-xl flex flex-col items-center justify-center text-center gap-1 transition-all ${
                    boostingAction === 'follow'
                      ? 'border-purple-600 bg-purple-50/50 text-purple-700 font-semibold'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <UserPlus size={18} />
                  <span className="text-xs">Apenas Seguir Contatos</span>
                </button>
                <button
                  onClick={() => setBoostingAction('message')}
                  className={`p-3 border rounded-xl flex flex-col items-center justify-center text-center gap-1 transition-all ${
                    boostingAction === 'message'
                      ? 'border-purple-600 bg-purple-50/50 text-purple-700 font-semibold'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <MessageSquare size={18} />
                  <span className="text-xs">Apenas Enviar DM + Áudio</span>
                </button>
                <button
                  onClick={() => setBoostingAction('both')}
                  className={`p-3 border rounded-xl flex flex-col items-center justify-center text-center gap-1 transition-all ${
                    boostingAction === 'both'
                      ? 'border-purple-600 bg-purple-50/50 text-purple-700 font-semibold'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Cpu size={18} />
                  <span className="text-xs">Seguir + DM + Áudio</span>
                </button>
              </div>

              {/* 3. Seleção de leads de destino */}
              <div className="space-y-3">
                <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 w-fit">
                  <button
                    onClick={() => setLeadsSource('manual')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      leadsSource === 'manual' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    Digitar Contatos Manualmente
                  </button>
                  <button
                    onClick={() => setLeadsSource('followers')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      leadsSource === 'followers' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    Selecionar da Base de Leads
                  </button>
                </div>

                {leadsSource === 'manual' ? (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Inserir Usuários do Instagram (um por linha)</label>
                    <textarea
                      value={manualLeads}
                      onChange={(e) => setManualLeads(e.target.value)}
                      placeholder="usuario_alvo1&#10;usuario_alvo2&#10;usuario_alvo3"
                      className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-55"
                    />
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50 space-y-2 p-3">
                    <div className="flex items-center gap-2 bg-white px-3 py-2 border border-gray-200 rounded-lg">
                      <Search className="text-gray-400" size={16} />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar contatos da base..."
                        className="w-full text-xs outline-none bg-transparent"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1.5">
                      {filteredSystemLeads.length === 0 ? (
                        <div className="text-center py-4 text-xs text-gray-400">Nenhum lead encontrado.</div>
                      ) : (
                        filteredSystemLeads.map((lead) => (
                          <div 
                            key={lead.username} 
                            onClick={() => {
                              setSelectedSystemLeads(prev => 
                                prev.includes(lead.username) ? prev.filter(u => u !== lead.username) : [...prev, lead.username]
                              );
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer border transition-colors ${
                              selectedSystemLeads.includes(lead.username)
                                ? 'bg-purple-50 border-purple-300'
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <span className="font-medium">@{lead.username}</span>
                            <span className="text-[10px] text-gray-400">{lead.city || 'Desconhecida'}</span>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="text-right text-[10px] text-gray-500 font-medium">
                      Selecionados: {selectedSystemLeads.length} leads
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Configurações de conteúdo */}
              {(boostingAction === 'message' || boostingAction === 'both') && (
                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Mensagem Convite (Texto)</label>
                    <textarea
                      value={messageTemplate}
                      onChange={(e) => setMessageTemplate(e.target.value)}
                      className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-55"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600 block">Mensagem em Áudio (Opcional - Formato M4A, MP3 ou WAV)</label>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer px-4 py-2 border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all">
                        <Upload size={14} />
                        Selecionar Áudio
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={handleAudioUpload}
                          className="hidden"
                        />
                      </label>
                      {uploadingAudio ? (
                        <span className="text-xs text-purple-600 flex items-center gap-1.5">
                          <RefreshCw className="animate-spin" size={14} /> Enviando e convertendo...
                        </span>
                      ) : audioFilename ? (
                        <span className="text-xs text-emerald-600 flex items-center gap-1">
                          <FileAudio size={14} /> {audioFilename} (Upload Ok)
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Nenhum áudio selecionado.</span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500">
                      O áudio será enviado diretamente por direct message como se fosse gravado na hora!
                    </p>
                  </div>
                </div>
              )}

              {/* 5. Atrasos e Rotatividade */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-gray-100 pt-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Intervalo Mínimo (segundos)</label>
                  <input
                    type="number"
                    value={minDelay}
                    onChange={(e) => setMinDelay(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-gray-55"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Intervalo Máximo (segundos)</label>
                  <input
                    type="number"
                    value={maxDelay}
                    onChange={(e) => setMaxDelay(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-gray-55"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Alternar Conta A Cada (ações)</label>
                  <input
                    type="number"
                    value={rotateEvery}
                    onChange={(e) => setRotateEvery(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-gray-55"
                  />
                </div>
              </div>

              {/* 6. Ações da campanha */}
              <div className="flex justify-end pt-4 gap-3">
                {botStatus === 'running' ? (
                  <button
                    onClick={handleStopCampaign}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 shadow-sm"
                  >
                    <Square size={16} />
                    Parar Automação
                  </button>
                ) : (
                  <button
                    onClick={handleStartCampaign}
                    className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 shadow-md"
                  >
                    <Play size={16} />
                    Iniciar Automação de Engajamento
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: AUTOMATED BATCH POSTING */}
          {activeTab === 'posts' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Postagem em Lote para Aquecimento</h2>
                <p className="text-gray-500 text-xs mt-1">
                  Selecione múltiplas contas para fazer postagens simultâneas ou agendadas. Isso mantém as contas ativas e aquecidas ("aquecimento de conta") com conteúdos consistentes no feed.
                </p>
              </div>

              {/* 1. Selecionar contas receptoras */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700">Contas Alvos (receberão a publicação)</label>
                  <button 
                    onClick={selectAllPostAccounts}
                    className="text-xs text-purple-600 font-semibold hover:underline"
                  >
                    {postAccounts.length === savedAccounts.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1 border border-gray-200 rounded-lg bg-gray-50">
                  {savedAccounts.length === 0 ? (
                    <span className="text-xs text-gray-400 p-2">Nenhuma conta cadastrada. Conecte contas primeiro.</span>
                  ) : (
                    savedAccounts.map((acc) => (
                      <button
                        key={acc.username}
                        onClick={() => togglePostAccount(acc.username)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${
                          postAccounts.includes(acc.username)
                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        @{acc.username}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* 2. Upload da Imagem */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600 block">Imagem da Publicação</label>
                <div className="flex flex-col md:flex-row gap-4 items-start">
                  <label className="w-full md:w-48 h-36 border-2 border-dashed border-gray-300 hover:border-purple-500 hover:bg-purple-50/20 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden bg-gray-50">
                    {postImagePreview ? (
                      <img 
                        src={postImagePreview} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-3 text-gray-400 space-y-1">
                        <Upload className="mx-auto" size={24} />
                        <span className="text-xs font-semibold block text-gray-700">Carregar Foto</span>
                        <span className="text-[10px] text-gray-400 block">Aspecto sugerido: 1:1</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePostImageChange}
                      className="hidden"
                    />
                  </label>

                  <div className="flex-1 space-y-1 w-full">
                    <label className="text-xs font-semibold text-gray-600">Legenda da Publicação (Caption)</label>
                    <textarea
                      value={postCaption}
                      onChange={(e) => setPostCaption(e.target.value)}
                      className="w-full h-28 px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-55"
                      placeholder="Insira as tags, textos e emojis para a publicação..."
                    />
                  </div>
                </div>
              </div>

              {/* 3. Ações de envio */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <span className="text-xs font-medium text-purple-600">
                  {postingStatus}
                </span>
                <button
                  onClick={handlePublishPost}
                  disabled={isPosting || postAccounts.length === 0 || !postImage}
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 shadow-md disabled:opacity-50"
                >
                  {isPosting ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} /> Publicando...
                    </>
                  ) : (
                    <>
                      <Upload size={16} /> Publicar nas Contas
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: AUTOMATED ACCOUNT CREATION */}
          {activeTab === 'create_accounts' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Criar Contas do Zero</h2>
                <p className="text-gray-500 text-xs mt-1">
                  Crie novas contas do Instagram automaticamente usando a API do SMS-Activate para obter os números e Playwright para o cadastro.
                </p>
              </div>

              {/* DICA DE INSTALAÇÃO DO PYTHON & SERVIDOR DEDICADO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-purple-600 animate-pulse" size={18} />
                    <span className="text-xs font-bold text-purple-900">Requisito do Sistema</span>
                  </div>
                  <p className="text-[11px] text-purple-700 leading-relaxed">
                    Para utilizar este recurso, sua máquina precisa ter o **Python** e o **Google Chrome** instalados. 
                    Facilitamos isso para você! Basta abrir a pasta raiz do seu robô no computador e dar um duplo clique no arquivo:
                  </p>
                  <div className="flex items-center gap-1.5 bg-white border border-purple-200 px-3 py-1.5 rounded-lg text-xs font-mono text-purple-900 w-fit">
                    instalar_python.bat
                  </div>
                  <p className="text-[10px] text-purple-500">
                    Esse arquivo instalará silenciosamente o Python e todas as bibliotecas necessárias automaticamente.
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Cpu className="text-blue-600 animate-pulse" size={18} />
                      <span className="text-xs font-bold text-blue-900">Servidor de Criação Dedicado</span>
                    </div>
                    <p className="text-[11px] text-blue-700 leading-relaxed mt-2">
                      Para gerar contas de forma independente sem interromper ou afetar suas campanhas ativas, use o servidor dedicado.
                    </p>
                    <p className="text-[10px] text-blue-500 mt-1">
                      Execute o executável abaixo localmente para abrir o microservidor na porta **5001** específico para criação de contas.
                    </p>
                  </div>
                  <a
                    href="/creator_server.exe"
                    download="creator_server.exe"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all duration-200 shadow-sm w-full mt-2"
                  >
                    <Download size={14} />
                    Baixar Servidor do Criador (creator_server.exe)
                  </a>
                </div>
              </div>

              <form onSubmit={handleCreateAccounts} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* SMS API KEY */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 block">Chave API do 5sim.net</label>
                    <input
                      type="text"
                      value={smsKey}
                      onChange={(e) => setSmsKey(e.target.value)}
                      placeholder="Insira sua API Key do 5sim.net"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-55"
                      required
                    />
                    <p className="text-[9px] text-gray-400">
                      Necessário para comprar os chips virtuais e receber o SMS de cadastro.
                    </p>
                  </div>

                  {/* COUNTRY */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 block">País do Chip</label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-55"
                    >
                      <option value="brazil">Brasil - Recomendado</option>
                      <option value="russia">Rússia - Mais barato</option>
                      <option value="ukraine">Ucrânia</option>
                      <option value="colombia">Colômbia</option>
                      <option value="usa">Estados Unidos</option>
                    </select>
                  </div>

                  {/* USERNAME PREFIX */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 block">Prefixo dos Usuários</label>
                    <input
                      type="text"
                      value={usernamePrefix}
                      onChange={(e) => setUsernamePrefix(e.target.value)}
                      placeholder="Ex: sdg, loja, insta"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-55"
                      required
                    />
                    <p className="text-[9px] text-gray-400">
                      As contas serão criadas como: prefixo_letrasaleatorias
                    </p>
                  </div>

                  {/* PASSWORD */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 block">Senha Padrão (Opcional)</label>
                    <input
                      type="text"
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      placeholder="Deixe em branco para senha aleatória"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-55"
                    />
                  </div>

                  {/* PROXY */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-semibold text-gray-600 block">Proxy Residencial (Opcional)</label>
                    <input
                      type="text"
                      value={createProxy}
                      onChange={(e) => setCreateProxy(e.target.value)}
                      placeholder="IP:PORTA ou IP:PORTA:USUARIO:SENHA"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-55"
                    />
                    <p className="text-[9px] text-gray-400">
                      Recomendado para evitar bloqueios ao criar mais de 2 contas seguidas.
                    </p>
                  </div>

                  {/* QUANTIDADE DE CONTAS */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 block">Quantidade de Contas</label>
                    <input
                      type="number"
                      value={createCount}
                      onChange={(e) => setCreateCount(Number(e.target.value))}
                      min={1}
                      max={20}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-55"
                      required
                    />
                  </div>

                </div>

                {/* BOTÕES DE AÇÃO */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-100 gap-4">
                  <div className="text-[11px] text-amber-600 font-semibold leading-normal max-w-xs">
                    * Nota: A janela do navegador se abrirá. Caso apareça o CAPTCHA de animais, resolva-o manualmente na tela para ajudar o robô!
                  </div>
                  {creatorStatus === 'running' || creatorStatus === 'stopping' ? (
                    <button
                      type="button"
                      onClick={handleStopCreator}
                      disabled={creatorStatus === 'stopping'}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 shadow-sm shrink-0 disabled:opacity-50"
                    >
                      <Square size={16} />
                      {creatorStatus === 'stopping' ? 'Parando...' : 'Parar Automação'}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isCreating}
                      className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 shadow-md disabled:opacity-50 shrink-0"
                    >
                      <Sparkles size={16} />
                      {isCreating ? 'Iniciando...' : 'Iniciar Criação de Contas'}
                    </button>
                  )}
                </div>
              </form>

              {/* LISTA DE CONTAS GERADAS */}
              <div className="border-t border-gray-100 pt-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                      Contas Criadas no Sistema
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                        {fullAccounts.length}
                      </span>
                    </h3>
                    <p className="text-gray-500 text-xs mt-0.5">
                      Veja abaixo todas as contas geradas com usuário e senha salvos no robô.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportTXT}
                      type="button"
                      disabled={fullAccounts.length === 0}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 disabled:hover:bg-gray-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                      title="Baixar arquivo TXT formatado como usuario:senha"
                    >
                      <Download size={13} />
                      Exportar TXT
                    </button>
                    <button
                      onClick={handleExportJSON}
                      type="button"
                      disabled={fullAccounts.length === 0}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 disabled:hover:bg-gray-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                      title="Baixar todas as credenciais em formato JSON"
                    >
                      <Download size={13} />
                      Exportar JSON
                    </button>
                    <a
                      href={`${apiUrl}/api/accounts/export`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                      title="Download direto do Servidor"
                    >
                      <ExternalLink size={13} />
                      Servidor TXT
                    </a>
                  </div>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {fullAccountsError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 mb-2 font-medium">
                      <XCircle size={14} className="text-rose-600 shrink-0" />
                      <span>{fullAccountsError}</span>
                    </div>
                  )}
                  {fullAccounts.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-xs">
                      Nenhuma conta criada ou salva encontrada no banco de dados local.
                    </div>
                  ) : (
                    fullAccounts.map((acc, index) => (
                      <div
                        key={acc.username + '-' + index}
                        className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100/80 rounded-xl border border-gray-200 transition-colors gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                            {(acc.username || '').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-gray-800 text-xs block truncate">
                              @{acc.username}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono block truncate mt-0.5">
                              Senha: {acc.password || '******'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleCopyText(`${acc.username}:${acc.password || ''}`, acc.username)}
                            type="button"
                            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Copiar Usuário:Senha"
                          >
                            {copiedUser === acc.username ? (
                              <Check size={14} className="text-emerald-500" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Execution Status & Real-time Logs Console */}
        <div className="space-y-6">
          
          {/* Status box */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-800">
              {activeTab === 'create_accounts' ? 'Status do Criador' : 'Status do Robô'}
            </h3>
            
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-2.5">
                <span className={`w-3 h-3 rounded-full ${
                  currentStatus === 'running' 
                    ? 'bg-emerald-500 animate-pulse' 
                    : currentStatus === 'stopping'
                    ? 'bg-amber-500 animate-pulse'
                    : currentStatus === 'completed'
                    ? 'bg-blue-500'
                    : 'bg-gray-400'
                }`} />
                <div>
                  <span className="text-xs font-bold text-gray-700 block">
                    {currentStatus === 'running' && 'Em Execução'}
                    {currentStatus === 'stopping' && 'Interrompendo...'}
                    {currentStatus === 'completed' && 'Finalizado'}
                    {currentStatus === 'idle' && 'Ocioso'}
                    {currentStatus === 'offline' && 'Servidor Offline'}
                    {currentStatus === 'error' && 'Erro de Execução'}
                  </span>
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">
                    {activeTab === 'create_accounts' ? 'Servidor Porta 5001' : 'Servidor Porta 5000'}
                  </span>
                </div>
              </div>
              
              {currentStatus === 'running' && (currentProgress?.total ?? 0) > 0 && (
                <div className="text-right">
                  <span className="text-sm font-black text-purple-600">
                    {Math.round(((currentProgress?.current ?? 0) / (currentProgress?.total ?? 1)) * 100)}%
                  </span>
                  <span className="text-[9px] text-gray-400 block font-semibold">
                    {currentProgress?.current ?? 0}/{currentProgress?.total ?? 0}
                  </span>
                </div>
              )}
            </div>

            {currentStatus === 'running' && currentProgress?.current_user && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>Trabalhando no perfil alvo:</span>
                  <span className="font-semibold text-purple-600">@{currentProgress.current_user}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div 
                    className="bg-purple-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(currentProgress?.total ?? 0) > 0 ? ((currentProgress?.current ?? 0) / (currentProgress?.total ?? 1)) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Logs Terminal Console */}
          <div className="bg-gray-900 rounded-2xl shadow-lg border border-gray-800 flex flex-col h-[400px]">
            <div className="bg-gray-800/80 px-4 py-2 border-b border-gray-800 rounded-t-2xl flex items-center justify-between text-white">
              <div className="flex items-center gap-2 text-xs font-bold font-mono">
                <Terminal size={14} className="text-pink-500" />
                <select
                  value={consoleMode}
                  onChange={(e) => setConsoleMode(e.target.value as any)}
                  className="bg-gray-950 text-gray-200 border border-gray-700 rounded px-2 py-1 text-[11px] font-semibold focus:outline-none focus:ring-1 focus:ring-pink-500 cursor-pointer"
                >
                  <option value="unified">Console Geral Unificado</option>
                  <option value="bot">Console do Robô (Porta 5000)</option>
                  <option value="creator">Console do Criador (Porta 5001)</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleCopyConsole}
                  disabled={currentLogs.length === 0}
                  className="text-[10px] font-semibold text-gray-400 hover:text-white transition-colors uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-40"
                  title="Copiar todos os logs exibidos para a área de transferência"
                >
                  {copiedConsole ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  {copiedConsole ? 'Copiado!' : 'Copiar'}
                </button>
                <span className="text-gray-700 font-normal">|</span>
                <button 
                  onClick={() => {
                    if (consoleMode === 'unified') {
                      setCreatorLogs([]);
                      setCampaignLogs([]);
                    } else if (consoleMode === 'creator') {
                      setCreatorLogs([]);
                    } else {
                      setCampaignLogs([]);
                    }
                  }}
                  className="text-[10px] font-semibold text-gray-400 hover:text-white transition-colors uppercase tracking-wider"
                >
                  Limpar
                </button>
              </div>
            </div>
            
            <div ref={logsContainerRef} className="flex-1 p-4 overflow-y-auto font-mono text-[11px] text-gray-300 space-y-2 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
              {currentLogs.length === 0 ? (
                <div className="text-gray-600 text-center py-16 italic">
                  {consoleMode === 'unified'
                    ? 'Nenhum log registrado no sistema até o momento.'
                    : consoleMode === 'creator'
                    ? 'Aguardando início da criação automática de contas para registrar os eventos...'
                    : 'Aguardando início de alguma atividade ou postagem automática para registrar os eventos...'}
                </div>
              ) : (
                currentLogs.map((log, idx) => {
                  const safeLog = typeof log === 'string' ? log : (log ? JSON.stringify(log) : '');
                  return (
                    <div 
                      key={idx} 
                      className={`leading-relaxed border-l-2 pl-2 ${
                        safeLog.includes('SUCESSO') 
                          ? 'text-emerald-400 border-emerald-500' 
                          : safeLog.includes('ERRO') || safeLog.includes('AVISO')
                          ? 'text-rose-400 border-rose-500'
                          : 'text-gray-300 border-purple-500'
                      }`}
                    >
                      {safeLog}
                    </div>
                  );
                })
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      );
    };

export default AccountAutomation;
