import React, { useEffect, useState } from 'react';
import { fetchPosts } from '../utils/api';
import { Plus, Grid, List, Filter, Heart, MessageSquare } from 'lucide-react';
import type { Post } from '../types';

const Posts: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPosts() {
      try {
        const postsList = await fetchPosts();
        setPosts(postsList);
      } catch (err) {
        console.error('Error loading posts:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPosts();
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gestão de Conteúdo</h2>
          <p className="text-gray-500">Gerencie suas publicações e agendamentos.</p>
        </div>
        <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-lg shadow-purple-600/20">
          <Plus size={20} />
          Novo Post
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
        <div className="flex gap-2">
          {['Todos', 'Publicados', 'Agendados', 'Rascunhos'].map((tab) => (
            <button key={tab} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'Todos' ? 'bg-purple-50 text-purple-600' : 'text-gray-500 hover:bg-gray-50'
            }`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-100">
            <button className="p-1.5 bg-white shadow-sm rounded-md text-purple-600"><Grid size={18} /></button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"><List size={18} /></button>
          </div>
          <button className="flex items-center gap-2 text-gray-500 text-sm font-medium px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors border border-gray-100">
            <Filter size={18} />
            Filtrar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {posts.map((post) => (
          <div key={post.id} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm group cursor-pointer hover:shadow-md transition-all">
            <div className="relative aspect-square bg-gray-50">
              <img src={post.imageUrl} alt={post.caption} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-white font-bold">
                <span className="flex items-center gap-1.5"><Heart size={20} fill="currentColor" /> {post.likes}</span>
                <span className="flex items-center gap-1.5"><MessageSquare size={20} fill="currentColor" /> {post.commentsCount}</span>
              </div>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex justify-between items-center text-xs text-gray-400">
                <span>{new Date(post.date).toLocaleDateString('pt-BR')}</span>
                <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">Publicado</span>
              </div>
              <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">
                {post.caption}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Posts;

