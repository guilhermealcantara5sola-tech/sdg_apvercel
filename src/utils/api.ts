import { mockMetrics, mockPosts, mockMessages } from '../mocks/data';

const API_BASE = 'http://localhost:5000';

export async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return await res.json();
  } catch (err) {
    console.warn('API error, using mock data:', err);
    return {
      metrics: mockMetrics,
      audience: {
        cities: [
          { name: 'Almenara', value: 25.6 },
          { name: 'Belo Horizonte', value: 4.8 },
          { name: 'Araçuaí', value: 3.5 },
          { name: 'Rubim', value: 3.2 },
          { name: 'Jacinto', value: 2.5 }
        ],
        age_groups: [
          { age: '13-17', value: 0.7 },
          { age: '18-24', value: 10.3 },
          { age: '25-34', value: 31.4 },
          { age: '35-44', value: 29.0 },
          { age: '45-54', value: 16.9 },
          { age: '55-64', value: 8.1 },
          { age: '65+', value: 3.2 }
        ],
        gender: [
          { name: 'Homens', value: 47.8 },
          { name: 'Mulheres', value: 52.1 }
        ],
        weekday_activity: [
          { day: 'Segunda', value: 12700 },
          { day: 'Terça', value: 12700 },
          { day: 'Quarta', value: 12800 },
          { day: 'Quinta', value: 12800 },
          { day: 'Sexta', value: 12700 },
          { day: 'Sábado', value: 12700 },
          { day: 'Domingo', value: 12800 }
        ]
      }
    };
  }
}

export async function fetchPosts() {
  try {
    const res = await fetch(`${API_BASE}/api/posts`);
    if (!res.ok) throw new Error('Failed to fetch posts');
    return await res.json();
  } catch (err) {
    console.warn('API error, using mock data:', err);
    return mockPosts;
  }
}

export async function fetchChats() {
  try {
    const res = await fetch(`${API_BASE}/api/chats`);
    if (!res.ok) throw new Error('Failed to fetch chats');
    return await res.json();
  } catch (err) {
    console.warn('API error, using mock data:', err);
    return mockMessages;
  }
}

export async function fetchChatMessages(folderId: string) {
  try {
    const res = await fetch(`${API_BASE}/api/chat/${folderId}`);
    if (!res.ok) throw new Error('Failed to fetch chat messages');
    return await res.json();
  } catch (err) {
    console.warn('API error, returning mock messages for chat:', err);
    const chat = mockMessages.find(m => m.id === folderId) || mockMessages[0];
    return {
      title: chat.sender,
      participants: [chat.sender, 'Thenperson Oriebir'],
      messages: [
        {
          sender: 'Thenperson Oriebir',
          content: 'Olá! Como posso ajudar você hoje?',
          time: '14:20',
          date: 'Hoje',
          timestamp_ms: Date.now() - 300000
        },
        {
          sender: chat.sender,
          content: chat.lastMessage,
          time: chat.time,
          date: 'Hoje',
          timestamp_ms: Date.now() - 60000
        }
      ]
    };
  }
}

export async function fetchFollowers() {
  try {
    const res = await fetch(`${API_BASE}/api/followers`);
    if (!res.ok) throw new Error('Failed to fetch followers');
    return await res.json();
  } catch (err) {
    console.warn('API error, generating mock followers list:', err);
    const mockFollowers = Array.from({ length: 50 }, (_, i) => ({
      username: `seguidor_mock_${i + 1}`,
      timestamp: Date.now() - i * 3600000,
      followed_back: i % 2 === 0
    }));
    return {
      followers: mockFollowers,
      following: mockFollowers.slice(0, 25),
      total_followers: 50,
      total_following: 25
    };
  }
}

export async function startBot(config: any) {
  const res = await fetch(`${API_BASE}/api/bot/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to start bot');
  }
  return await res.json();
}

export async function stopBot() {
  const res = await fetch(`${API_BASE}/api/bot/stop`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to stop bot');
  }
  return await res.json();
}

export async function fetchBotStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/bot/status`);
    if (!res.ok) throw new Error('Failed to fetch bot status');
    return await res.json();
  } catch (err) {
    return {
      status: 'idle',
      progress: { current: 0, total: 0, current_user: '' },
      logs: ['[SISTEMA] Backend offline. Conecte o servidor Python local para usar o robô de disparo.']
    };
  }
}
