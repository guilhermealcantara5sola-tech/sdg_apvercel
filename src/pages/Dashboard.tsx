import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Eye, 
  BarChart2, 
  Heart, 
  MessageSquare, 
  RefreshCw, 
  Send, 
  Grid, 
  ChevronRight,
  Zap
} from 'lucide-react';
import { fetchStats, fetchPosts, syncInstagram } from '../utils/api';
import type { Metric, Post } from '../types';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [username, setUsername] = useState('@thenperson');

  useEffect(() => {
    async function loadData() {
      try {
        const statsData = await fetchStats();
        const postsData = await fetchPosts();
        setMetrics(statsData.metrics);
        setPosts(postsData);
        
        const cachedUsername = localStorage.getItem('synced_instagram_username');
        if (cachedUsername) {
          setUsername(`@${cachedUsername}`);
        }
      } catch (err) {
        console.error('Error loading dashboard data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncInstagram();
      if (result.username) {
        setUsername(`@${result.username}`);
        localStorage.setItem('synced_instagram_username', result.username);
      }
      const statsData = await fetchStats();
      const postsData = await fetchPosts();
      setMetrics(statsData.metrics);
      setPosts(postsData);
      alert('🔄 Dados sincronizados em tempo real com sucesso!');
    } catch (err: any) {
      console.error(err);
      alert(`⚠️ Erro ao sincronizar: ${err.message || 'Verifique se o servidor local Python está ligado.'}`);
    } finally {
      setSyncing(false);
    }
  };

  const menuFeatures = [
    {
      title: 'Disparo de Campanhas',
      description: 'Crie campanhas automáticas para enviar direct messages (texto e áudio), seguir leads em massa ou comentar em publicações.',
      icon: Send,
      path: '/broadcast',
      gradient: 'from-purple-600 to-indigo-600',
      badge: 'Automação',
      shadowColor: 'rgba(147, 51, 234, 0.15)'
    },
    {
      title: 'Chat / Inbox Direct',
      description: 'Gerencie conversas reais integradas com filtros de pastas e envie respostas personalizadas no direct do Instagram.',
      icon: MessageSquare,
      path: '/inbox',
      gradient: 'from-blue-600 to-cyan-500',
      badge: 'Conversas',
      shadowColor: 'rgba(59, 130, 246, 0.15)'
    },
    {
      title: 'CRM & Filtro de Leads',
      description: 'Filtre sua base de seguidores importados por gênero, localização ou idade. Exporte leads prontos para envio.',
      icon: Users,
      path: '/leads',
      gradient: 'from-emerald-600 to-teal-500',
      badge: 'Contatos',
      shadowColor: 'rgba(16, 185, 129, 0.15)'
    },
    {
      title: 'Analytics & Demografia',
      description: 'Acompanhe gráficos detalhados do crescimento de seguidores, horários ativos, cidades do público e taxas de engajamento.',
      icon: BarChart2,
      path: '/analytics',
      gradient: 'from-pink-600 to-rose-500',
      badge: 'Métricas',
      shadowColor: 'rgba(236, 72, 153, 0.15)'
    },
    {
      title: 'Feed & Postagens',
      description: 'Monitore suas publicações, veja as curtidas, comentários e histórico de postagens do feed de forma centralizada.',
      icon: Grid,
      path: '/posts',
      gradient: 'from-amber-500 to-orange-500',
      badge: 'Conteúdo',
      shadowColor: 'rgba(245, 158, 11, 0.15)'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-gray-900 via-purple-950 to-slate-900 p-8 rounded-3xl text-white shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 bg-purple-500/20 text-purple-300 text-xs px-3 py-1 rounded-full font-semibold mb-3 border border-purple-500/30 w-fit">
              <Zap size={12} className="fill-current animate-pulse" />
              Painel Integrado Ativo
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight">Bem-vindo de volta, {username} 👋</h2>
            <p className="text-gray-300 text-sm mt-1.5 max-w-xl">
              Aqui está a central de controle das suas automações, campanhas e inteligência de leads do Instagram.
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 px-5 py-3 rounded-xl transition-all shadow-lg shadow-purple-600/30 hover:shadow-purple-600/40 hover:-translate-y-0.5 active:translate-y-0 shrink-0"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar Instagram'}
          </button>
        </div>
      </div>

      {/* Quick Access Grid ("Quadradinhos") */}
      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Recursos e Atalhos</h3>
          <p className="text-gray-500 text-sm">Selecione uma funcionalidade do sistema para gerenciar ou monitorar.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuFeatures.map((item, index) => {
            const IconComponent = item.icon;
            return (
              <div
                key={index}
                onClick={() => navigate(item.path)}
                className="group relative bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-purple-200/60 cursor-pointer transition-all duration-300 transform hover:-translate-y-1.5 flex flex-col justify-between"
                style={{
                  boxShadow: `0 4px 6px -1px rgba(0, 0, 0, 0.01), 0 2px 4px -1px rgba(0, 0, 0, 0.005)`
                }}
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className={`p-3 bg-gradient-to-br ${item.gradient} text-white rounded-xl shadow-lg`} style={{ boxShadow: `0 10px 15px -3px ${item.shadowColor}` }}>
                      <IconComponent size={22} />
                    </span>
                    <span className="text-[10px] font-bold tracking-wider uppercase bg-gray-50 text-gray-400 group-hover:bg-purple-50 group-hover:text-purple-600 px-2.5 py-1 rounded-full transition-colors">
                      {item.badge}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-gray-800 group-hover:text-purple-600 transition-colors flex items-center gap-1.5">
                    {item.title}
                  </h4>
                  <p className="text-gray-500 text-xs mt-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>
                
                <div className="flex items-center text-xs font-semibold text-purple-600 mt-6 opacity-80 group-hover:opacity-100 transition-opacity">
                  Acessar Recurso
                  <ChevronRight size={14} className="ml-1 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="space-y-4 pt-4 border-t border-gray-100">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Estatísticas Rápidas</h3>
          <p className="text-gray-500 text-sm">Resumo de desempenho obtido a partir da sincronização de dados.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric, index) => (
            <div key={index} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group hover:border-purple-200 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <span className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                  {metric.label.includes('Seguidores') ? <Users size={18} /> : 
                   metric.label.includes('Alcance') ? <Eye size={18} /> :
                   metric.label.includes('Impressões') ? <BarChart2 size={18} /> : <Heart size={18} />}
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                  metric.change >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                }`}>
                  {metric.change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {Math.abs(metric.change)}%
                </span>
              </div>
              <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{metric.label}</h3>
              <p className="text-3xl font-extrabold text-gray-800 mt-1.5 tracking-tight">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
        {/* Recent Posts */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-800">Posts Recentes</h3>
            <button 
              onClick={() => navigate('/posts')}
              className="text-purple-600 text-sm font-bold hover:text-purple-700 transition-colors"
            >
              Ver todos posts
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {posts.slice(0, 4).map((post) => (
              <div key={post.id} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm group">
                <div className="relative aspect-square overflow-hidden bg-gray-50">
                  <img src={post.imageUrl} alt={post.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-white font-bold">
                    <span className="flex items-center gap-2"><Heart size={20} fill="currentColor" /> {post.likes}</span>
                    <span className="flex items-center gap-2"><MessageSquare size={20} fill="currentColor" /> {post.commentsCount}</span>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm text-gray-700 line-clamp-1 leading-relaxed">{post.caption}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Activity */}
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-800">Crescimento</h3>
            <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-xl"></div>
              <h4 className="font-bold text-lg mb-1">Melhor horário para postar</h4>
              <p className="text-purple-100 text-xs mb-5">Seus seguidores estão mais ativos às 19:00 nas quartas-feiras.</p>
              <button 
                onClick={() => navigate('/broadcast')}
                className="bg-white hover:bg-purple-50 text-purple-600 px-4 py-2.5 rounded-xl text-sm font-bold w-full shadow-md transition-colors"
              >
                Agendar Campanha
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h4 className="font-bold text-gray-800">Hashtags em alta</h4>
            <div className="flex flex-wrap gap-2">
              {['#tecnologia', '#desenvolvimento', '#produtividade', '#setup', '#automacao', '#instagram'].map(tag => (
                <span key={tag} className="bg-purple-50 text-purple-600 hover:bg-purple-100 cursor-pointer px-3 py-1.5 rounded-full text-xs font-semibold transition-colors">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
