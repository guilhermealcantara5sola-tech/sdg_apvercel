import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend } from 'recharts';
import { fetchStats } from '../utils/api';
import { Info, Users, MapPin, Calendar, Percent } from 'lucide-react';

const COLORS = ['#9333ea', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#64748b'];

const Analytics: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await fetchStats();
        setStats(data);
      } catch (err) {
        console.error('Error loading analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Generate historical data for charts if not present (simulate using growth rate)
  const mockTimeline = [
    { date: '01/06', followers: 1080, reach: 45000, engagement: 4.2 },
    { date: '02/06', followers: 1100, reach: 52000, engagement: 4.5 },
    { date: '03/06', followers: 1120, reach: 48000, engagement: 4.3 },
    { date: '04/06', followers: 1135, reach: 58000, engagement: 4.8 },
    { date: '05/06', followers: 1152, reach: 62000, engagement: 5.1 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Analytics Detalhado</h2>
          <p className="text-gray-500">Demográficos da audiência e dados reais de engajamento.</p>
        </div>
        <div className="flex gap-2">
          {['7D', '30D', '3M', '1A'].map(period => (
            <button key={period} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              period === '30D' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
            }`}>
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.metrics.map((metric: any, index: number) => (
          <div key={index} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-gray-500 text-sm font-medium">{metric.label}</h3>
            <p className="text-2xl font-bold text-gray-800 mt-1">{metric.value}</p>
            <span className={`text-xs font-semibold mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
              metric.change >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
            }`}>
              {metric.change >= 0 ? '+' : ''}{metric.change}% vs período anterior
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Followers by City */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg"><MapPin size={16} /></span>
              <h3 className="font-bold text-gray-800">Seguidores por Cidade</h3>
            </div>
            <Info size={16} className="text-gray-400" />
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.audience.cities} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#9ca3af'}} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#4b5563'}} width={80} />
                <Tooltip formatter={(value) => [`${value}%`, 'Porcentagem']} />
                <Bar dataKey="value" fill="#9333ea" radius={[0, 4, 4, 0]}>
                  {stats.audience.cities.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Followers by Age Group */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-pink-50 text-pink-600 rounded-lg"><Users size={16} /></span>
              <h3 className="font-bold text-gray-800">Distribuição por Faixa Etária</h3>
            </div>
            <Info size={16} className="text-gray-400" />
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.audience.age_groups}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="age" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#4b5563'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#9ca3af'}} />
                <Tooltip formatter={(value) => [`${value}%`, 'Seguidores']} />
                <Bar dataKey="value" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gender Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Percent size={16} /></span>
              <h3 className="font-bold text-gray-800">Distribuição por Gênero</h3>
            </div>
            <Info size={16} className="text-gray-400" />
          </div>
          <div className="h-[250px] w-full flex items-center justify-center">
            {stats.audience.gender && stats.audience.gender.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.audience.gender}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell fill="#3b82f6" />
                    <Cell fill="#ec4899" />
                  </Pie>
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-400 text-sm">Sem dados disponíveis</p>
            )}
          </div>
        </div>

        {/* Weekday Activity */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-green-50 text-green-600 rounded-lg"><Calendar size={16} /></span>
              <h3 className="font-bold text-gray-800">Atividade dos Seguidores por Dia</h3>
            </div>
            <Info size={16} className="text-gray-400" />
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.audience.weekday_activity}>
                <defs>
                  <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#4b5563'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#9ca3af'}} />
                <Tooltip formatter={(value: any) => [`${value.toLocaleString('pt-BR')} contas`, 'Atividade']} />
                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorActivity)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;

