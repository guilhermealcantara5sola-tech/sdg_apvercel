import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend } from 'recharts';
import { fetchStats, fetchFollowers } from '../utils/api';
import { Info, Users, MapPin, Calendar, Percent } from 'lucide-react';

const COLORS = ['#9333ea', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#64748b'];

const Analytics: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [followers, setFollowers] = useState<any[]>([]);
  const [period, setPeriod] = useState('30D');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const statsData = await fetchStats();
        const followersData = await fetchFollowers();
        setStats(statsData);
        setFollowers(followersData.followers || []);
      } catch (err) {
        console.error('Error loading analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const getFilteredAudience = () => {
    if (!stats) return null;
    if (followers.length === 0) return stats.audience;

    const now = Date.now();
    const filteredFollowers = followers.filter(f => {
      const diffMs = now - f.timestamp;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (period === '7D') return diffDays <= 7;
      if (period === '30D') return diffDays <= 30;
      if (period === '3M') return diffDays <= 90;
      if (period === '1A') return diffDays <= 365;
      return true;
    });

    const totalCount = filteredFollowers.length || 1;

    // 1. Cidades
    const cityCounts: Record<string, number> = {};
    filteredFollowers.forEach(f => {
      const city = f.city || "Outras";
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    });
    const cities = Object.entries(cityCounts).map(([name, count]) => ({
      name,
      value: parseFloat(((count / totalCount) * 100).toFixed(1))
    })).sort((a, b) => b.value - a.value).slice(0, 5);

    // 2. Faixa Etária
    const ageCounts: Record<string, number> = {};
    filteredFollowers.forEach(f => {
      const age = f.age_group || "Adulto";
      ageCounts[age] = (ageCounts[age] || 0) + 1;
    });
    const ageGroupLabelsMap: Record<string, string> = {
      "Criança": "13-17",
      "Jovem": "18-24",
      "Adulto": "25-34",
      "Idoso": "55+"
    };
    const age_groups = Object.entries(ageCounts).map(([ageKey, count]) => {
      const age = ageGroupLabelsMap[ageKey] || ageKey;
      return {
        age,
        value: parseFloat(((count / totalCount) * 100).toFixed(1))
      };
    });

    // 3. Gênero
    let menCount = 0;
    let womenCount = 0;
    filteredFollowers.forEach(f => {
      if (f.gender === "Homens") menCount++;
      else womenCount++;
    });
    const gender = [
      { name: 'Homens', value: parseFloat(((menCount / totalCount) * 100).toFixed(1)) },
      { name: 'Mulheres', value: parseFloat(((womenCount / totalCount) * 100).toFixed(1)) }
    ];

    return {
      cities: cities.length > 0 ? cities : stats.audience.cities,
      age_groups: age_groups.length > 0 ? age_groups : stats.audience.age_groups,
      gender: gender.length > 0 ? gender : stats.audience.gender,
      weekday_activity: stats.audience.weekday_activity
    };
  };

  const getFilteredMetrics = () => {
    if (!stats) return [];
    if (followers.length === 0) return stats.metrics;

    const now = Date.now();
    const periodFollowers = followers.filter(f => {
      const diffMs = now - f.timestamp;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (period === '7D') return diffDays <= 7;
      if (period === '30D') return diffDays <= 30;
      if (period === '3M') return diffDays <= 90;
      if (period === '1A') return diffDays <= 365;
      return true;
    });

    const newFollowersCount = periodFollowers.length;

    return stats.metrics.map((m: any) => {
      if (m.label === 'Novos Seguidores') {
        return { ...m, value: String(newFollowersCount) };
      }
      return m;
    });
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const audience = getFilteredAudience();
  const metrics = getFilteredMetrics();
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Analytics Detalhado</h2>
          <p className="text-gray-500">Demográficos da audiência e dados reais de engajamento.</p>
        </div>
        <div className="flex gap-2">
          {['7D', '30D', '3M', '1A'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === p ? 'bg-purple-600 text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
              }`}
            >
              {p === '7D' ? '7 Dias' : p === '30D' ? '30 Dias' : p === '3M' ? '3 Meses' : '1 Ano'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric: any, index: number) => (
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
              <BarChart data={audience?.cities || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#9ca3af'}} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#4b5563'}} width={80} />
                <Tooltip formatter={(value) => [`${value}%`, 'Porcentagem']} />
                <Bar dataKey="value" fill="#9333ea" radius={[0, 4, 4, 0]}>
                  {(audience?.cities || []).map((_: any, index: number) => (
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
              <BarChart data={audience?.age_groups || []}>
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
            {audience?.gender && audience.gender.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={audience.gender}
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
              <AreaChart data={audience?.weekday_activity || []}>
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

