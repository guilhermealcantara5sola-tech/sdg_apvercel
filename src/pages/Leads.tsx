import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFollowers, syncInstagram } from '../utils/api';
import { Users, Search, Filter, MessageSquare, ExternalLink, MapPin, Calendar, Heart, ShieldCheck, RefreshCw, Download, FileText } from 'lucide-react';

const Leads: React.FC = () => {
  const navigate = useNavigate();
  const [followers, setFollowers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filtros
  const [genderFilter, setGenderFilter] = useState('Todos');
  const [ageFilter, setAgeFilter] = useState('Todos');
  const [cityFilter, setCityFilter] = useState('Todas');
  const [followedBackFilter, setFollowedBackFilter] = useState('Todos');
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncInstagram();
      const data = await fetchFollowers();
      setFollowers(data.followers || []);
      alert('🔄 Base de leads sincronizada com o Instagram em tempo real!');
    } catch (err: any) {
      console.error(err);
      alert(`⚠️ Erro ao sincronizar: ${err.message || 'Verifique se o servidor local Python está ligado.'}`);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    async function loadFollowers() {
      try {
        const data = await fetchFollowers();
        setFollowers(data.followers || []);
      } catch (err) {
        console.error('Error loading followers/leads:', err);
      } finally {
        setLoading(false);
      }
    }
    loadFollowers();
  }, []);

  // Filtrar
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

  // Métricas
  const totalLeads = followers.length;
  const followedBackCount = followers.filter(f => f.followed_back).length;
  const followBackRate = totalLeads > 0 ? Math.round((followedBackCount / totalLeads) * 100) : 0;
  
  const femaleCount = followers.filter(f => f.gender === 'Mulheres').length;
  const femaleRate = totalLeads > 0 ? Math.round((femaleCount / totalLeads) * 100) : 0;

  // Cidade mais frequente
  const cityCounts: Record<string, number> = {};
  followers.forEach(f => {
    if (f.city && f.city !== 'Outras') {
      cityCounts[f.city] = (cityCounts[f.city] || 0) + 1;
    }
  });
  const topCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Almenara';

  const citiesList = ['Todas', 'Almenara', 'Belo Horizonte', 'Araçuaí', 'Rubim', 'Jacinto', 'Outras'];

  const handleOpenChat = (username: string) => {
    navigate(`/inbox?chat=${username}`);
  };

  const exportToTXT = () => {
    if (filteredFollowers.length === 0) {
      alert('⚠️ Nenhuma linha encontrada para exportar.');
      return;
    }
    const usernames = filteredFollowers.map(f => f.username).join('\n');
    const blob = new Blob([usernames], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `leads_filtrados_${new Date().toISOString().slice(0,10)}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToCSV = () => {
    if (filteredFollowers.length === 0) {
      alert('⚠️ Nenhuma linha encontrada para exportar.');
      return;
    }
    const headers = 'Username,Tipo,Gênero,Faixa Etária,Cidade,Seguidor Desde\n';
    const rows = filteredFollowers.map(f => {
      const type = f.followed_back ? 'Seguidor' : 'Contato Direct';
      const gender = f.gender === 'Mulheres' ? 'Feminino' : 'Masculino';
      const date = new Date(f.timestamp).toLocaleDateString('pt-BR');
      return `"${f.username}","${type}","${gender}","${f.age_group}","${f.city}","${date}"`;
    }).join('\n');
    
    const csvContent = '\uFEFF' + headers + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `leads_filtrados_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm animate-fadeIn">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Leads e Seguidores</h2>
          <p className="text-gray-500 text-sm">Gerencie e analise a base de contatos importada e integrada com o Supabase.</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 px-4 py-2.5 rounded-xl transition-all shadow-sm hover:shadow hover:-translate-y-0.5 active:translate-y-0 shrink-0"
        >
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Sincronizando...' : 'Sincronizar Leads'}
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <span className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Users size={24} />
          </span>
          <div>
            <span className="text-xs font-semibold text-gray-400 block uppercase tracking-wider">Total de Leads</span>
            <span className="text-2xl font-bold text-gray-800">{totalLeads}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <span className="p-3 bg-green-50 text-green-600 rounded-xl">
            <ShieldCheck size={24} />
          </span>
          <div>
            <span className="text-xs font-semibold text-gray-400 block uppercase tracking-wider">Segue de Volta</span>
            <span className="text-2xl font-bold text-gray-800">{followedBackCount} <span className="text-sm text-gray-400 font-normal">({followBackRate}%)</span></span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <span className="p-3 bg-pink-50 text-pink-600 rounded-xl">
            <Heart size={24} />
          </span>
          <div>
            <span className="text-xs font-semibold text-gray-400 block uppercase tracking-wider">Feminino / Masculino</span>
            <span className="text-2xl font-bold text-gray-800">{femaleRate}% <span className="text-sm text-gray-400 font-normal">/ {100 - femaleRate}%</span></span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <span className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <MapPin size={24} />
          </span>
          <div>
            <span className="text-xs font-semibold text-gray-400 block uppercase tracking-wider">Cidade Principal</span>
            <span className="text-2xl font-bold text-gray-800">{topCity}</span>
          </div>
        </div>
      </div>

      {/* Control Panel / Segmentador */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-md space-y-6">
        <div>
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Filter className="text-purple-600" size={20} />
            Segmentador de Leads e Filtros
          </h3>
          <p className="text-xs text-gray-500">Crie listas personalizadas combinando os filtros abaixo e exporte os resultados.</p>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Pesquisa por Username</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder="Pesquisar @username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Gênero</label>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="Todos">Todos os Gêneros</option>
              <option value="Mulheres">Feminino</option>
              <option value="Homens">Masculino</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Faixa Etária</label>
            <select
              value={ageFilter}
              onChange={(e) => setAgeFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="Todos">Todas as Idades</option>
              <option value="Criança">Criança (13-17)</option>
              <option value="Jovem">Jovem (18-24)</option>
              <option value="Adulto">Adulto (25-54)</option>
              <option value="Idoso">Idoso (55+)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Cidade</label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              {citiesList.map(c => (
                <option key={c} value={c}>{c === 'Todas' ? 'Todas as Cidades' : c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* More Filters & Export Row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-4 border-t border-gray-100 gap-4">
          <div className="w-full sm:w-auto">
            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Tipo de Contato</label>
            <select
              value={followedBackFilter}
              onChange={(e) => setFollowedBackFilter(e.target.value)}
              className="w-full sm:w-64 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="Todos">Todos (Seguidores + Chats)</option>
              <option value="Sim">Apenas Seguidores</option>
              <option value="Não">Apenas Contatos de Direct</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-3 w-full sm:w-auto pt-4 sm:pt-0">
            <button
              onClick={exportToTXT}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 text-sm font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-4 py-2.5 rounded-xl transition-all shadow-sm"
              title="Baixar lista com um username por linha"
            >
              <FileText size={16} className="text-purple-600" />
              Exportar TXT (Disparos)
            </button>
            <button
              onClick={exportToCSV}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 px-4 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
              title="Baixar tabela completa em Excel/CSV"
            >
              <Download size={16} />
              Exportar Lista (CSV)
            </button>
          </div>
        </div>
      </div>

      {/* Leads List / Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {filteredFollowers.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Lead / Usuário</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-center">Tipo de Lead</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-center">Gênero</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-center">Faixa Etária</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-center">Cidade</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-center">Ação Direct</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredFollowers.map((follower) => (
                    <tr key={follower.username} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={`https://api.dicebear.com/7.x/initials/svg?seed=${follower.username}`} 
                            alt="" 
                            className="w-10 h-10 rounded-full bg-purple-100 border border-purple-200"
                          />
                          <div>
                            <span className="font-bold text-gray-800 text-sm block">@{follower.username}</span>
                            <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                              <Calendar size={10} />
                              Cadastrado em {new Date(follower.timestamp).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                          follower.followed_back 
                            ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                            : 'bg-blue-50 text-blue-700 border border-blue-100'
                        }`}>
                          {follower.followed_back ? 'Seguidor' : 'Contato Direct'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600 font-semibold">
                        {follower.gender === 'Mulheres' ? 'Feminino' : 'Masculino'}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600 font-semibold">
                        {follower.age_group}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600 font-semibold">
                        {follower.city}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleOpenChat(follower.username)}
                            className="flex items-center gap-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow active:scale-95"
                            title="Ver Chat / Direct"
                          >
                            <MessageSquare size={14} />
                            Enviar Direct
                          </button>
                          <a 
                            href={`https://instagram.com/${follower.username}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all border border-gray-100"
                            title="Ver no Instagram"
                          >
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-gray-100">
              {filteredFollowers.map((follower) => (
                <div key={follower.username} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img 
                        src={`https://api.dicebear.com/7.x/initials/svg?seed=${follower.username}`} 
                        alt="" 
                        className="w-10 h-10 rounded-full bg-purple-100"
                      />
                      <div>
                        <span className="font-bold text-gray-800 text-sm">@{follower.username}</span>
                        <span className="text-[10px] text-gray-400 block font-medium">
                          {new Date(follower.timestamp).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      follower.followed_back 
                        ? 'bg-purple-50 text-purple-700' 
                        : 'bg-blue-50 text-blue-700'
                    }`}>
                      {follower.followed_back ? 'Seguidor' : 'Contato Direct'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2.5 rounded-xl text-center text-xs">
                    <div>
                      <span className="text-[10px] text-gray-400 block font-bold uppercase">Gênero</span>
                      <span className="font-semibold text-gray-700">{follower.gender === 'Mulheres' ? 'Fem.' : 'Masc.'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block font-bold uppercase">Idade</span>
                      <span className="font-semibold text-gray-700">{follower.age_group}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block font-bold uppercase">Cidade</span>
                      <span className="font-semibold text-gray-700 truncate block">{follower.city}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <a 
                      href={`https://instagram.com/${follower.username}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-gray-50"
                    >
                      <ExternalLink size={14} />
                      Instagram
                    </a>
                    <button
                      onClick={() => handleOpenChat(follower.username)}
                      className="flex-1 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-purple-700 shadow-sm"
                    >
                      <MessageSquare size={14} />
                      Ver Conversa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16 text-gray-400 space-y-2">
            <Users className="mx-auto text-gray-300" size={48} />
            <p className="font-medium">Nenhum seguidor ou lead encontrado</p>
            <p className="text-xs text-gray-400">Verifique se você importou os dados no seu painel ou altere os filtros.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leads;
