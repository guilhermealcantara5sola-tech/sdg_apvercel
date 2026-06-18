import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchSavedAccounts } from '../utils/api';
import { Cpu, Users, MessageSquare, Heart, Sparkles, AlertTriangle, ShieldCheck, TrendingUp } from 'lucide-react';

const Analytics: React.FC = () => {
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [loading, setLoading] = useState(true);

  // Planejamento de Estratégia States
  const [simulatedAccounts, setSimulatedAccounts] = useState(0);
  const [dmsPerDay, setDmsPerDay] = useState(40);
  const [likesPerDay, setLikesPerDay] = useState(80);
  const [followsPerDay, setFollowsPerDay] = useState(50);
  const [campaignDays, setCampaignDays] = useState(30);
  const [conversionRate, setConversionRate] = useState(3); // em %

  useEffect(() => {
    async function loadAccountsData() {
      try {
        const accounts = await fetchSavedAccounts();
        if (Array.isArray(accounts)) {
          setTotalAccounts(accounts.length);
          setSimulatedAccounts(accounts.length > 0 ? accounts.length : 5); // Fallback padrão
        }
      } catch (err) {
        console.error('Error loading accounts for strategy:', err);
        setSimulatedAccounts(5);
      } finally {
        setLoading(false);
      }
    }
    loadAccountsData();
  }, []);

  // Cálculos de Projeção
  const totalDMs = simulatedAccounts * dmsPerDay * campaignDays;
  const totalLikes = simulatedAccounts * likesPerDay * campaignDays;
  const totalFollows = simulatedAccounts * followsPerDay * campaignDays;
  const totalActions = totalDMs + totalLikes + totalFollows;
  
  // Estimativa de alcance único (DMs + Follows com margem de overlap)
  const estimatedReach = Math.round((totalDMs + totalFollows) * 0.88);
  
  // Estimativa de conversões (Leads de alta intenção com base na taxa de conversão)
  const estimatedConversions = Math.round((totalDMs * (conversionRate / 100)));

  // Geração de dados de crescimento diário para o gráfico
  const getChartData = () => {
    const data = [];
    const dailyDMs = simulatedAccounts * dmsPerDay;
    const dailyFollows = simulatedAccounts * followsPerDay;
    const dailyReach = Math.round((dailyDMs + dailyFollows) * 0.88);
    const dailyConversions = dailyDMs * (conversionRate / 100);

    for (let day = 1; day <= campaignDays; day++) {
      data.push({
        day: `Dia ${day}`,
        "Alcance Acumulado": dailyReach * day,
        "Directs Enviados": dailyDMs * day,
        "Conversões": Math.round(dailyConversions * day)
      });
    }
    return data;
  };

  // Recomendações de Segurança
  const getSecurityWarnings = () => {
    const warnings = [];
    if (dmsPerDay > 50) {
      warnings.push({
        type: 'danger',
        msg: `Directs (${dmsPerDay}): Risco ALTO de bloqueio temporário. O Instagram impõe limites rígidos. Recomendamos no máximo 40 directs/dia.`
      });
    } else if (dmsPerDay > 40) {
      warnings.push({
        type: 'warning',
        msg: `Directs (${dmsPerDay}): Limite moderado. Use proxys residenciais de boa qualidade e rotacione as contas frequentemente.`
      });
    }

    if (followsPerDay > 80) {
      warnings.push({
        type: 'danger',
        msg: `Seguidas (${followsPerDay}): Limite excessivo. O Instagram bloqueia a ação de seguir rapidamente. Recomendamos no máximo 60 seguidas/dia.`
      });
    }

    if (likesPerDay > 120) {
      warnings.push({
        type: 'warning',
        msg: `Curtidas (${likesPerDay}): Limite ligeiramente alto. Tente manter abaixo de 100/dia para aquecer contas novas.`
      });
    }

    return warnings;
  };

  const warnings = getSecurityWarnings();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-6 text-zinc-100 shadow-xl relative overflow-hidden glow-border-purple">
        <div className="absolute right-0 top-0 opacity-5 transform translate-x-1/4 -translate-y-1/4 scale-150 text-purple-500">
          <TrendingUp size={250} />
        </div>
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-950/30 border border-purple-500/20 text-purple-300 rounded-full text-xs font-mono font-semibold backdrop-blur-md">
            <Sparkles size={12} className="text-purple-400 animate-pulse" />
            <span>estudo_de_viabilidade: ativo</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight font-mono text-zinc-100 flex items-center gap-2">
            <span className="text-purple-500">&gt;_</span> Planejador de Estratégias & Alcance
          </h1>
          <p className="text-zinc-400 max-w-2xl text-xs leading-relaxed">
            Calcule estimativas de campanhas e projete o crescimento com base nas suas contas do Instagram. Defina metas de direct, curtidas e seguidas por conta para simular resultados.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA DA ESQUERDA: CONTROLE DE SIMULAÇÃO */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6 shadow-sm">
          <div>
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2 font-mono">
              <Cpu size={16} className="text-purple-400" />
              Parâmetros de Simulação
            </h3>
            <p className="text-zinc-500 text-[11px] mt-1">
              Modifique os controles abaixo para calcular o alcance.
            </p>
          </div>

          <div className="space-y-4">
            
            {/* CONTAS DO INSTAGRAM */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-zinc-300">
                <span>Contas Utilizadas</span>
                <span className="text-purple-400 font-mono">{simulatedAccounts} perfis</span>
              </div>
              <input
                type="range"
                min="1"
                max={Math.max(30, totalAccounts + 10)}
                value={simulatedAccounts}
                onChange={(e) => setSimulatedAccounts(Number(e.target.value))}
                className="w-full accent-purple-500 bg-zinc-950 border-zinc-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span>Mín: 1</span>
                <span>Contas conectadas: {totalAccounts}</span>
                <span>Simulado: {simulatedAccounts}</span>
              </div>
            </div>

            {/* DIRECTS DIÁRIOS */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-zinc-300">
                <span>Mensagens Direct / Dia (por conta)</span>
                <span className="text-purple-400 font-mono">{dmsPerDay} directs</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                value={dmsPerDay}
                onChange={(e) => setDmsPerDay(Number(e.target.value))}
                className="w-full accent-purple-500 bg-zinc-950 border-zinc-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span>Recomendado: 30-40</span>
                <span>Max: 100</span>
              </div>
            </div>

            {/* SEGUIDAS DIÁRIAS */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-zinc-300">
                <span>Ações de Seguir / Dia (por conta)</span>
                <span className="text-purple-400 font-mono">{followsPerDay} seguidas</span>
              </div>
              <input
                type="range"
                min="5"
                max="150"
                value={followsPerDay}
                onChange={(e) => setFollowsPerDay(Number(e.target.value))}
                className="w-full accent-purple-500 bg-zinc-950 border-zinc-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span>Recomendado: 50-60</span>
                <span>Max: 150</span>
              </div>
            </div>

            {/* CURTIDAS DIÁRIAS */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-zinc-300">
                <span>Curtidas / Dia (por conta)</span>
                <span className="text-purple-400 font-mono">{likesPerDay} curtidas</span>
              </div>
              <input
                type="range"
                min="10"
                max="200"
                value={likesPerDay}
                onChange={(e) => setLikesPerDay(Number(e.target.value))}
                className="w-full accent-purple-500 bg-zinc-950 border-zinc-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span>Recomendado: 80-100</span>
                <span>Max: 200</span>
              </div>
            </div>

            {/* DURAÇÃO DA CAMPANHA */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-zinc-300">
                <span>Duração da Campanha</span>
                <span className="text-purple-400 font-mono">{campaignDays} dias</span>
              </div>
              <input
                type="range"
                min="1"
                max="90"
                value={campaignDays}
                onChange={(e) => setCampaignDays(Number(e.target.value))}
                className="w-full accent-purple-500 bg-zinc-950 border-zinc-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span>1 dia</span>
                <span>3 meses (90d)</span>
              </div>
            </div>

            {/* TAXA DE CONVERSÃO */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-zinc-300">
                <span>Taxa Estimada de Resposta / Lead</span>
                <span className="text-emerald-400 font-mono">{conversionRate}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="25"
                value={conversionRate}
                onChange={(e) => setConversionRate(Number(e.target.value))}
                className="w-full accent-emerald-500 bg-zinc-950 border-zinc-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span>Conservador: 1-3%</span>
                <span>Otimista: 10%</span>
              </div>
            </div>

          </div>
        </div>

        {/* COLUNA DA DIREITA: RESULTADOS E PROJEÇÕES */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* CARDS DE ESTIMATIVAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* ESTIMATIVA DE ALCANCE */}
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex items-start gap-4 shadow-sm relative overflow-hidden">
              <div className="p-3 bg-purple-950/40 border border-purple-800/40 rounded-xl text-purple-400 shrink-0">
                <Users size={22} />
              </div>
              <div className="space-y-1">
                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">Alcance Único Estimado</span>
                <span className="text-3xl font-black text-zinc-100 font-mono block">
                  {estimatedReach.toLocaleString('pt-BR')}
                </span>
                <span className="text-[10px] text-purple-400 font-semibold block leading-tight">
                  Contas únicas atingidas na campanha
                </span>
              </div>
            </div>

            {/* ESTIMATIVA DE LEAD CONVERSÃO */}
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex items-start gap-4 shadow-sm relative overflow-hidden glow-border-emerald">
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-emerald-400 shrink-0">
                <Sparkles size={22} className="animate-pulse" />
              </div>
              <div className="space-y-1">
                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">Leads / Respostas Estimadas</span>
                <span className="text-3xl font-black text-emerald-400 font-mono block">
                  {estimatedConversions.toLocaleString('pt-BR')}
                </span>
                <span className="text-[10px] text-emerald-500 font-semibold block leading-tight">
                  Contatos interessados em potencial
                </span>
              </div>
            </div>

          </div>

          {/* DETALHAMENTO DE AÇÕES TOTAIS */}
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">
              Volume Total de Ações no Período
            </h3>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              
              <div className="bg-zinc-950/80 border border-zinc-800/50 p-3 rounded-xl">
                <div className="flex items-center justify-center gap-1.5 text-purple-400 text-xs font-semibold mb-1">
                  <MessageSquare size={13} />
                  <span>Mensagens</span>
                </div>
                <span className="text-xl font-extrabold text-zinc-100 font-mono">
                  {totalDMs.toLocaleString('pt-BR')}
                </span>
                <span className="text-[9px] text-zinc-500 block mt-0.5">Enviadas por direct</span>
              </div>

              <div className="bg-zinc-950/80 border border-zinc-800/50 p-3 rounded-xl">
                <div className="flex items-center justify-center gap-1.5 text-pink-400 text-xs font-semibold mb-1">
                  <Heart size={13} />
                  <span>Curtidas</span>
                </div>
                <span className="text-xl font-extrabold text-zinc-100 font-mono">
                  {totalLikes.toLocaleString('pt-BR')}
                </span>
                <span className="text-[9px] text-zinc-500 block mt-0.5">Curtidas nos perfis</span>
              </div>

              <div className="bg-zinc-950/80 border border-zinc-800/50 p-3 rounded-xl">
                <div className="flex items-center justify-center gap-1.5 text-blue-400 text-xs font-semibold mb-1">
                  <Users size={13} />
                  <span>Seguidas</span>
                </div>
                <span className="text-xl font-extrabold text-zinc-100 font-mono">
                  {totalFollows.toLocaleString('pt-BR')}
                </span>
                <span className="text-[9px] text-zinc-500 block mt-0.5">Novos follows feitos</span>
              </div>

            </div>

            <div className="bg-zinc-950 border border-zinc-800/60 rounded-xl p-3 flex justify-between items-center text-xs">
              <span className="font-semibold text-zinc-400">Total de Operações de Rede</span>
              <span className="font-mono font-bold text-purple-400 text-sm">
                {totalActions.toLocaleString('pt-BR')} ações
              </span>
            </div>
          </div>

          {/* AVISOS DE SEGURANÇA */}
          {warnings.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-sm space-y-3">
              <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <AlertTriangle size={15} />
                Diretrizes de Saúde das Contas
              </h4>
              <div className="space-y-2">
                {warnings.map((warn, idx) => (
                  <div key={idx} className={`p-3 border rounded-xl text-xs flex gap-2 ${
                    warn.type === 'danger'
                      ? 'bg-rose-950/20 border-rose-800/40 text-rose-400'
                      : 'bg-yellow-950/20 border-yellow-800/40 text-yellow-400'
                  }`}>
                    <span>•</span>
                    <span>{warn.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {warnings.length === 0 && (
            <div className="bg-emerald-950/15 border border-emerald-900/30 p-4 rounded-2xl flex items-center gap-3 text-emerald-400 text-xs font-medium">
              <ShieldCheck size={18} className="text-emerald-500 shrink-0" />
              <span>Configurações seguras! Todos os limites diários estão dentro da faixa recomendada para evitar o bloqueio de contas.</span>
            </div>
          )}

        </div>
      </div>

      {/* GRÁFICO DE PROJEÇÃO DE CRESCIMENTO */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-bold text-zinc-100 font-mono flex items-center gap-2">
              <TrendingUp size={16} className="text-purple-400" />
              Projeção de Crescimento Acumulado
            </h3>
            <p className="text-zinc-500 text-[11px]">Gráfico de estimativa acumulada ao longo dos dias de campanha.</p>
          </div>
          <div className="text-[10px] text-zinc-400 font-mono bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
            Período: {campaignDays}d
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={getChartData()}>
              <defs>
                <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9333ea" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorDMs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#202023" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#71717a'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#71717a'}} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '11px', color: '#f4f4f5' }}
                formatter={(value: any) => [value.toLocaleString('pt-BR'), '']}
              />
              <Area type="monotone" dataKey="Alcance Acumulado" stroke="#9333ea" strokeWidth={2.5} fillOpacity={1} fill="url(#colorReach)" />
              <Area type="monotone" dataKey="Directs Enviados" stroke="#a855f7" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorDMs)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};

export default Analytics;
