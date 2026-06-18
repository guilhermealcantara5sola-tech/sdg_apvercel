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
  saveSettings
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
  Search
} from 'lucide-react';


interface Account {
  username: string;
  status: 'pending' | 'verified' | 'failed';
  errorMsg?: string;
}

const AccountAutomation: React.FC = () => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'accounts' | 'boosting' | 'posts' | 'create_accounts'>('accounts');

  // 4. Tab Criar Contas
  const [smsKey, setSmsKey] = useState(() => localStorage.getItem('sms_activate_key') || '');
  const [country, setCountry] = useState('brazil'); 
  const [usernamePrefix, setUsernamePrefix] = useState('sdg');
  const [createPassword, setCreatePassword] = useState('');
  const [createProxy, setCreateProxy] = useState('');
  const [createCount, setCreateCount] = useState(1);
  const [isCreating, setIsCreating] = useState(false);

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

  const logEndRef = useRef<HTMLDivElement>(null);
  
  // Fetch Saved Accounts & System Leads
  const loadAccounts = async () => {
    try {
      const data = await fetchSavedAccounts();
      const accountsList = data.map((acc: any) => ({
        username: acc.username,
        status: 'pending' as const
      }));
      setSavedAccounts(accountsList);
    } catch (err) {
      console.error('Error fetching accounts:', err);
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
      const settings = await fetchSettings();
      if (settings.sms_activate_key) setSmsKey(settings.sms_activate_key);
      if (settings.country) setCountry(settings.country);
      if (settings.username_prefix) setUsernamePrefix(settings.username_prefix);
      if (settings.proxy) setCreateProxy(settings.proxy);
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  useEffect(() => {
    loadAccounts();
    loadSystemLeads();
    loadSettingsFromServer();
  }, []);

  // Poll Bot Status when campaign is running
  useEffect(() => {
    let timer: any;
    const checkStatus = async () => {
      try {
        const state = await fetchBotStatus();
        setBotStatus(state.status);
        setBotProgress(state.progress);
        if (state.logs) {
          setCampaignLogs(state.logs);
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

  // Scroll to logs end
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [campaignLogs]);

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
    setCampaignLogs(['[SISTEMA] Iniciando criador de contas automático...']);
    setBotStatus('running');

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
      setBotStatus('idle');
    } finally {
      setIsCreating(false);
    }
  };

  // Filtering leads search
  const filteredSystemLeads = systemLeads.filter(lead => 
    lead.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header and description */}
      <div className="bg-gradient-to-r from-purple-700 via-purple-600 to-pink-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4 scale-150">
          <Cpu size={250} />
        </div>
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-semibold backdrop-blur-md">
            <Sparkles size={14} /> Múltiplas Contas & Crescimento
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Painel de Automação de Contas</h1>
          <p className="text-purple-100 max-w-2xl text-sm">
            Gerencie múltiplos perfis no Instagram de forma centralizada. Conecte contas, realize ações automatizadas de engajamento (seguir, envio de mensagens e áudio) e agende posts automáticos para alimentar seus perfis em escala.
          </p>
        </div>
      </div>

      {/* Navigation sub-tabs */}
      <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm gap-2 max-w-2xl">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
            activeTab === 'accounts' 
              ? 'bg-purple-600 text-white shadow-md' 
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <UserPlus size={16} />
          Conectar Contas
        </button>
        <button
          onClick={() => setActiveTab('boosting')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
            activeTab === 'boosting' 
              ? 'bg-purple-600 text-white shadow-md' 
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Cpu size={16} />
          Impulsionar
        </button>
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
            activeTab === 'posts' 
              ? 'bg-purple-600 text-white shadow-md' 
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <ImageIcon size={16} />
          Postar Mídia
        </button>
        <button
          onClick={() => setActiveTab('create_accounts')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
            activeTab === 'create_accounts' 
              ? 'bg-purple-600 text-white shadow-md' 
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Sparkles size={16} />
          Criar Contas
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
                  {savedAccounts.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-sm">
                      Nenhuma conta conectada no momento. Use o formulário acima para conectar.
                    </div>
                  ) : (
                    savedAccounts.map((acc) => (
                      <div key={acc.username} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm">
                            {acc.username.charAt(0).toUpperCase()}
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

              {/* DICA DE INSTALAÇÃO DO PYTHON */}
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
                  {botStatus === 'running' ? (
                    <button
                      type="button"
                      onClick={handleStopCampaign}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 shadow-sm shrink-0"
                    >
                      <Square size={16} />
                      Parar Automação
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
            </div>
          )}
        </div>

        {/* Right Column: Execution Status & Real-time Logs Console */}
        <div className="space-y-6">
          
          {/* Status box */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-800">Status do Robô</h3>
            
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-2.5">
                <span className={`w-3 h-3 rounded-full ${
                  botStatus === 'running' 
                    ? 'bg-emerald-500 animate-pulse' 
                    : botStatus === 'stopping'
                    ? 'bg-amber-500 animate-pulse'
                    : botStatus === 'completed'
                    ? 'bg-blue-500'
                    : 'bg-gray-400'
                }`} />
                <div>
                  <span className="text-xs font-bold text-gray-700 block">
                    {botStatus === 'running' && 'Em Execução'}
                    {botStatus === 'stopping' && 'Interrompendo...'}
                    {botStatus === 'completed' && 'Finalizado'}
                    {botStatus === 'idle' && 'Ocioso'}
                    {botStatus === 'offline' && 'Servidor Offline'}
                    {botStatus === 'error' && 'Erro de Execução'}
                  </span>
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">Conexão Local</span>
                </div>
              </div>
              
              {botStatus === 'running' && botProgress.total > 0 && (
                <div className="text-right">
                  <span className="text-sm font-black text-purple-600">{Math.round((botProgress.current / botProgress.total) * 100)}%</span>
                  <span className="text-[9px] text-gray-400 block font-semibold">{botProgress.current}/{botProgress.total}</span>
                </div>
              )}
            </div>

            {botStatus === 'running' && botProgress.current_user && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>Trabalhando no perfil alvo:</span>
                  <span className="font-semibold text-purple-600">@{botProgress.current_user}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div 
                    className="bg-purple-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(botProgress.current / botProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Logs Terminal Console */}
          <div className="bg-gray-900 rounded-2xl shadow-lg border border-gray-800 flex flex-col h-[400px]">
            <div className="bg-gray-800/80 px-4 py-3 border-b border-gray-800 rounded-t-2xl flex items-center justify-between text-white">
              <div className="flex items-center gap-2 text-xs font-bold font-mono">
                <Terminal size={14} className="text-pink-500" />
                Console de Atividade (Real-time)
              </div>
              <button 
                onClick={() => setCampaignLogs([])}
                className="text-[10px] font-semibold text-gray-400 hover:text-white transition-colors uppercase tracking-wider"
              >
                Limpar
              </button>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] text-gray-300 space-y-2 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
              {campaignLogs.length === 0 ? (
                <div className="text-gray-600 text-center py-16 italic">
                  Aguardando início de alguma atividade ou postagem automática para registrar os eventos...
                </div>
              ) : (
                campaignLogs.map((log, idx) => (
                  <div 
                    key={idx} 
                    className={`leading-relaxed border-l-2 pl-2 ${
                      log.includes('SUCESSO') 
                        ? 'text-emerald-400 border-emerald-500' 
                        : log.includes('ERRO') || log.includes('AVISO')
                        ? 'text-rose-400 border-rose-500'
                        : 'text-gray-300 border-purple-500'
                    }`}
                  >
                    {log}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default AccountAutomation;
