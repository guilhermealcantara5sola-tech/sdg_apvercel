import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Users, Eye, BarChart2, Heart, MessageSquare } from 'lucide-react';
import { fetchStats, fetchPosts } from '../utils/api';
import type { Metric, Post } from '../types';

const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const statsData = await fetchStats();
        const postsData = await fetchPosts();
        setMetrics(statsData.metrics);
        setPosts(postsData);
      } catch (err) {
        console.error('Error loading dashboard data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Bem-vindo de volta, @thenperson 👋</h2>
        <p className="text-gray-500">Aqui está o que aconteceu com sua conta nos últimos 30 dias.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <span className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                {metric.label.includes('Seguidores') ? <Users size={20} /> : 
                 metric.label.includes('Alcance') ? <Eye size={20} /> :
                 metric.label.includes('Impressões') ? <BarChart2 size={20} /> : <Heart size={20} />}
              </span>
              <span className={`text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 ${
                metric.change >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
              }`}>
                {metric.change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(metric.change)}%
              </span>
            </div>
            <h3 className="text-gray-500 text-sm font-medium">{metric.label}</h3>
            <p className="text-2xl font-bold text-gray-800 mt-1">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Posts */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800">Posts Recentes</h3>
            <button className="text-purple-600 text-sm font-medium hover:underline">Ver todos</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {posts.slice(0, 4).map((post) => (
              <div key={post.id} className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm group">
                <div className="relative aspect-square overflow-hidden bg-gray-50">
                  <img src={post.imageUrl} alt={post.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-white font-bold">
                    <span className="flex items-center gap-2"><Heart size={20} fill="currentColor" /> {post.likes}</span>
                    <span className="flex items-center gap-2"><MessageSquare size={20} fill="currentColor" /> {post.commentsCount}</span>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm text-gray-600 line-clamp-1">{post.caption}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Activity */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Dicas de Crescimento</h3>
          <div className="bg-gradient-to-br from-purple-600 to-pink-500 rounded-2xl p-6 text-white">
            <h4 className="font-bold mb-2">Melhor horário para postar</h4>
            <p className="text-purple-100 text-sm mb-4">Seus seguidores estão mais ativos às 19:00 nas quartas-feiras.</p>
            <button className="bg-white text-purple-600 px-4 py-2 rounded-lg text-sm font-bold w-full">Agendar agora</button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h4 className="font-bold text-gray-800 mb-4">Hashtags em alta</h4>
            <div className="flex flex-wrap gap-2">
              {['#tecnologia', '#desenvolvimento', '#produtividade', '#setup'].map(tag => (
                <span key={tag} className="bg-gray-50 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">
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

