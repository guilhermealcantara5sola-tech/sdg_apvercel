import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFollowers } from '../utils/api';
import { Users, Search, Filter, MessageSquare, ExternalLink, MapPin, Calendar, Heart, ShieldCheck } from 'lucide-react';

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
  const [showFilters, setShowFilters] = useState(false);

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
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Leads e Seguidores</h2>
        <p className="text-gray-500">Gerencie e analise a base de contatos importada e integrada com o Supabase.</p>
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

      {/* Control Panel */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="Pesquisar por nome de usuário (@username)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
              showFilters || genderFilter !== 'Todos' || ageFilter !== 'Todos' || cityFilter !== 'Todas' || followedBackFilter !== 'Todos'
                ? 'bg-purple-50 border-purple-200 text-purple-600'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter size={18} />
            Filtros Avançados
          </button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="p-4 bg-gray-50/50 border border-gray-100 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-4 animate-fadeIn">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Gênero</label>
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none"
              >
                <option value="Todos">Todos</option>
                <option value="Mulheres">Feminino</option>
                <option value="Homens">Masculino</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Faixa Etária</label>
              <select
                value={ageFilter}
                onChange={(e) => setAgeFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none"
              >
                <option value="Todos">Todas</option>
                <option value="Criança">Criança (13-17)</option>
                <option value="Jovem">Jovem (18-24)</option>
                <option value="Adulto">Adulto (25-54)</option>
                <option value="Idoso">Idoso (55+)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Cidade</label>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none"
              >
                {citiesList.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Segue de volta?</label>
              <select
                value={followedBackFilter}
                onChange={(e) => setFollowedBackFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none"
              >
                <option value="Todos">Todos</option>
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
              </select>
            </div>
          </div>
        )}
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
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Seguidor</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Segue de volta?</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Gênero</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Faixa Etária</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Cidade</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-right">Ações</th>
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
                            className="w-9 h-9 rounded-full bg-purple-100"
                          />
                          <div>
                            <span className="font-bold text-gray-800 text-sm block">@{follower.username}</span>
                            <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                              <Calendar size={10} />
                              {new Date(follower.timestamp).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          follower.followed_back 
                            ? 'bg-green-50 text-green-700' 
                            : 'bg-gray-50 text-gray-500'
                        }`}>
                          {follower.followed_back ? 'Sim' : 'Não'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                        {follower.gender === 'Mulheres' ? 'Feminino' : 'Masculino'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                        {follower.age_group}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                        {follower.city}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <a 
                            href={`https://instagram.com/${follower.username}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                            title="Ver no Instagram"
                          >
                            <ExternalLink size={16} />
                          </a>
                          <button
                            onClick={() => handleOpenChat(follower.username)}
                            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                            title="Ver Chat / Direct"
                          >
                            <MessageSquare size={16} />
                          </button>
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
                        ? 'bg-green-50 text-green-700' 
                        : 'bg-gray-50 text-gray-500'
                    }`}>
                      {follower.followed_back ? 'Segue de volta' : 'Não segue'}
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
