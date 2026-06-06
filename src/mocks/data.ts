import type { Post, Metric, AnalyticsData, Message } from '../types';

export const mockMetrics: Metric[] = [
  { label: 'Total Seguidores', value: '12.5K', change: 2.5 },
  { label: 'Alcance (30 dias)', value: '45.2K', change: 12.1 },
  { label: 'Engajamento Médio', value: '4.8%', change: -0.5 },
  { label: 'Novos Seguidores', value: '850', change: 5.4 },
];

export const mockPosts: Post[] = [
  {
    id: '1',
    imageUrl: 'https://picsum.photos/id/10/400/400',
    caption: 'Explorando novos horizontes! 🌊 #travel #nature',
    likes: 1240,
    commentsCount: 45,
    date: '2026-06-01',
  },
  {
    id: '2',
    imageUrl: 'https://picsum.photos/id/20/400/400',
    caption: 'Café da manhã produtivo hoje. ☕️ #work #morning',
    likes: 850,
    commentsCount: 22,
    date: '2026-05-30',
  },
  {
    id: '3',
    imageUrl: 'https://picsum.photos/id/30/400/400',
    caption: 'Setup atualizado para os novos projetos! 💻 #coding #setup',
    likes: 2100,
    commentsCount: 112,
    date: '2026-05-28',
  },
  {
    id: '4',
    imageUrl: 'https://picsum.photos/id/40/400/400',
    caption: 'Fim de tarde maravilhoso. 🌇',
    likes: 930,
    commentsCount: 18,
    date: '2026-05-25',
  },
];

export const mockAnalytics: AnalyticsData[] = [
  { date: '01/06', followers: 12100, reach: 1200, engagement: 4.2 },
  { date: '02/06', followers: 12250, reach: 1500, engagement: 4.5 },
  { date: '03/06', followers: 12380, reach: 1100, engagement: 4.3 },
  { date: '04/06', followers: 12420, reach: 1800, engagement: 4.8 },
  { date: '05/06', followers: 12500, reach: 2100, engagement: 5.1 },
];

export const mockMessages: Message[] = [
  {
    id: '1',
    sender: 'ana_silva',
    avatar: 'https://i.pravatar.cc/150?u=1',
    lastMessage: 'Amei as fotos do novo projeto!',
    time: '14:20',
    unread: true,
  },
  {
    id: '2',
    sender: 'joao_dev',
    avatar: 'https://i.pravatar.cc/150?u=2',
    lastMessage: 'Qual teclado você usa?',
    time: 'Ontem',
  },
  {
    id: '3',
    sender: 'maria_mkt',
    avatar: 'https://i.pravatar.cc/150?u=3',
    lastMessage: 'Enviamos a proposta por e-mail.',
    time: '2 dias',
  },
];
