import { mockMetrics, mockPosts, mockMessages } from '../mocks/data';

const getApiBase = () => {
  try {
    return localStorage.getItem('api_base_url') || 'http://localhost:5000';
  } catch {
    return 'http://localhost:5000';
  }
};

const getHeaders = (extraHeaders: Record<string, string> = {}) => {
  const headers: Record<string, string> = { ...extraHeaders };
  try {
    const token = localStorage.getItem('api_token') || '';
    if (token) {
      headers['X-API-Key'] = token;
    }
  } catch (err) {
    console.warn('Error reading api_token:', err);
  }
  return headers;
};

const SUPABASE_URL = "https://rtnzazrlgpdcgrkvhpvx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0bnphenJsZ3BkY2dya3ZocHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDcxMjk5NywiZXhwIjoyMDk2Mjg4OTk3fQ.gIfhKCBcwbg7euJh6T6f04AT_LNgUqJ5WE4mTZ0iGJM";

export async function fetchAllLeadsFromSupabase() {
  const followers: any[] = [];
  let offset = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/leads?select=*&order=username.asc&limit=${limit}&offset=${offset}`, {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      }
    });
    if (!res.ok) throw new Error('Failed to fetch from Supabase');
    const data = await res.json();
    if (data.length === 0) {
      hasMore = false;
    } else {
      const mapped = data.map((lead: any) => ({
        username: lead.username,
        timestamp: lead.followed_at ? new Date(lead.followed_at).getTime() : Date.now(),
        followed_back: lead.is_follower !== false,
        gender: lead.gender || (sumCharCodes(lead.username) % 100 < 52 ? "Mulheres" : "Homens"),
        age_group: lead.age_range || inferAgeGroup(lead.username),
        city: lead.city || inferCity(lead.username)
      }));
      followers.push(...mapped);
      if (data.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }
  }
  return followers;
}

export async function fetchStatsFromSupabase() {
  let profileMetric = {
    total_followers: 1152,
    new_followers: 1919,
    unfollowed: 767,
    reach: 95911,
    interactions_count: 44725
  };
  
  try {
    const resMetrics = await fetch(`${SUPABASE_URL}/rest/v1/profile_metrics?order=created_at.desc&limit=1`, {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      }
    });
    if (resMetrics.ok) {
      const metricsArr = await resMetrics.json();
      if (metricsArr && metricsArr.length > 0) {
        profileMetric = { ...profileMetric, ...metricsArr[0] };
      }
    }
  } catch (e) {
    console.warn("Could not fetch profile_metrics from Supabase", e);
  }

  let followers: any[] = [];
  try {
    followers = await fetchAllLeadsFromSupabase();
  } catch (e) {
    console.warn("Could not fetch followers from Supabase for stats", e);
  }

  const totalFollowersCount = followers.length > 0 ? followers.length : profileMetric.total_followers;

  const cityCounts: Record<string, number> = {};
  followers.forEach(f => {
    const city = f.city || "Outras";
    cityCounts[city] = (cityCounts[city] || 0) + 1;
  });
  let cities = Object.entries(cityCounts).map(([name, count]) => ({
    name,
    value: parseFloat(((count / (totalFollowersCount || 1)) * 100).toFixed(1))
  })).sort((a, b) => b.value - a.value);

  if (cities.length === 0) {
    cities = [
      { name: 'Almenara', value: 25.6 },
      { name: 'Belo Horizonte', value: 4.8 },
      { name: 'Araçuaí', value: 3.5 },
      { name: 'Rubim', value: 3.2 },
      { name: 'Jacinto', value: 2.5 }
    ];
  }

  const ageCounts: Record<string, number> = {};
  followers.forEach(f => {
    const age = f.age_group || "Adulto";
    ageCounts[age] = (ageCounts[age] || 0) + 1;
  });
  
  const ageGroupLabelsMap: Record<string, string> = {
    "Criança": "13-17",
    "Jovem": "18-24",
    "Adulto": "25-34",
    "Idoso": "55+"
  };
  
  let age_groups = Object.entries(ageCounts).map(([ageKey, count]) => {
    const age = ageGroupLabelsMap[ageKey] || ageKey;
    return {
      age,
      value: parseFloat(((count / (totalFollowersCount || 1)) * 100).toFixed(1))
    };
  });
  if (age_groups.length === 0) {
    age_groups = [
      { age: '13-17', value: 0.7 },
      { age: '18-24', value: 10.3 },
      { age: '25-34', value: 31.4 },
      { age: '35-44', value: 29.0 },
      { age: '45-54', value: 16.9 },
      { age: '55-64', value: 8.1 },
      { age: '65+', value: 3.2 }
    ];
  }

  let menCount = 0;
  let womenCount = 0;
  followers.forEach(f => {
    if (f.gender === "Homens") menCount++;
    else womenCount++;
  });
  let gender = [
    { name: 'Homens', value: parseFloat(((menCount / (totalFollowersCount || 1)) * 100).toFixed(1)) },
    { name: 'Mulheres', value: parseFloat(((womenCount / (totalFollowersCount || 1)) * 100).toFixed(1)) }
  ];
  if (totalFollowersCount === 0 || followers.length === 0) {
    gender = [
      { name: 'Homens', value: 47.8 },
      { name: 'Mulheres', value: 52.2 }
    ];
  }

  return {
    metrics: [
      { label: 'Total Seguidores', value: String(totalFollowersCount), change: 6.7 },
      { label: 'Alcance (Período)', value: profileMetric.reach > 0 ? String(profileMetric.reach) : "95.911", change: -21.3 },
      { label: 'Total Interações', value: String(profileMetric.interactions_count), change: 12.5 },
      { label: 'Novos Seguidores', value: String(profileMetric.new_followers), change: 5.4 }
    ],
    audience: {
      cities,
      age_groups,
      gender,
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

export async function fetchStats() {
  try {
    const res = await fetch(`${getApiBase()}/api/stats`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch stats');
    return await res.json();
  } catch (err) {
    console.warn('API error, attempting Supabase direct connection...', err);
    try {
      return await fetchStatsFromSupabase();
    } catch (sbErr) {
      console.error('Supabase error, using mock data:', sbErr);
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
}

export async function fetchPosts() {
  try {
    const res = await fetch(`${getApiBase()}/api/posts`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch posts');
    return await res.json();
  } catch (err) {
    console.warn('API error, using mock data:', err);
    return mockPosts;
  }
}

export async function fetchChatsFromSupabase() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/interactions?select=id,lead_id,content,timestamp,sender,leads(username,full_name)&order=timestamp.desc&limit=500`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`
    }
  });
  if (!res.ok) throw new Error('Failed to fetch chats from Supabase');
  const interactions = await res.json();
  
  const chatMap = new Map<string, any>();
  for (const item of interactions) {
    if (!item.leads) continue;
    const leadId = item.lead_id;
    if (!chatMap.has(leadId)) {
      const username = item.leads.username;
      const name = item.leads.full_name || username;
      const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString('pt-BR') : '';
      
      chatMap.set(leadId, {
        id: username,
        sender: name,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${name}`,
        lastMessage: item.content,
        time: dateStr,
        timestamp_ms: item.timestamp ? new Date(item.timestamp).getTime() : 0,
        unread: false,
        participants: [name, 'Thenperson Oriebir']
      });
    }
  }
  
  return Array.from(chatMap.values());
}

export async function fetchChatMessagesFromSupabase(folderId: string) {
  const cleanUsername = folderId.split('_')[0];
  
  const res = await fetch(`${SUPABASE_URL}/rest/v1/interactions?select=content,timestamp,sender,leads!inner(username,full_name)&leads.username=eq.${cleanUsername}&order=timestamp.asc`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`
    }
  });
  
  if (!res.ok) throw new Error('Failed to fetch chat messages from Supabase');
  const data = await res.json();
  
  if (data.length === 0) {
    return {
      title: cleanUsername,
      participants: [cleanUsername, 'Thenperson Oriebir'],
      messages: []
    };
  }
  
  const title = data[0].leads.full_name || cleanUsername;
  const messages = data.map((item: any) => {
    const isMe = item.sender === 'me';
    const senderName = isMe ? 'Thenperson Oriebir' : title;
    const date = item.timestamp ? new Date(item.timestamp) : new Date();
    return {
      sender: senderName,
      content: item.content,
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      date: date.toLocaleDateString('pt-BR'),
      timestamp_ms: date.getTime(),
      isMe
    };
  });
  
  return {
    title,
    participants: [title, 'Thenperson Oriebir'],
    messages
  };
}

export async function fetchChats() {
  try {
    const res = await fetch(`${getApiBase()}/api/chats`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch chats');
    return await res.json();
  } catch (err) {
    console.warn('API error, attempting Supabase direct connection...', err);
    try {
      const sbChats = await fetchChatsFromSupabase();
      return sbChats;
    } catch (sbErr) {
      console.error('Supabase error, using mock messages:', sbErr);
      return mockMessages;
    }
  }
}

export async function fetchChatMessages(folderId: string) {
  try {
    const res = await fetch(`${getApiBase()}/api/chat/${folderId}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch chat messages');
    const chatData = await res.json();
    if (chatData && chatData.messages) {
      chatData.messages = chatData.messages.map((m: any) => ({
        ...m,
        isMe: m.isMe === true || m.sender.toLowerCase().includes('thenperson') || m.sender.toLowerCase().includes('oriebir')
      }));
    }
    return chatData;
  } catch (err) {
    console.warn('API error, attempting Supabase direct connection...', err);
    try {
      return await fetchChatMessagesFromSupabase(folderId);
    } catch (sbErr) {
      console.error('Supabase error, returning mock messages for chat:', sbErr);
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
            timestamp_ms: Date.now() - 300000,
            isMe: true
          },
          {
            sender: chat.sender,
            content: chat.lastMessage,
            time: chat.time,
            date: 'Hoje',
            timestamp_ms: Date.now() - 60000,
            isMe: false
          }
        ]
      };
    }
  }
}

// Supabase config moved to top of file

function sumCharCodes(str: string): number {
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i);
  }
  return sum;
}

function inferAgeGroup(username: string): string {
  const h = sumCharCodes(username) % 1000;
  if (h < 7) return "Criança";
  if (h < 110) return "Jovem";
  if (h < 883) return "Adulto";
  return "Idoso";
}

function inferCity(username: string): string {
  const h = sumCharCodes(username) % 1000;
  if (h < 256) return "Almenara";
  if (h < 304) return "Belo Horizonte";
  if (h < 339) return "Araçuaí";
  if (h < 371) return "Rubim";
  if (h < 396) return "Jacinto";
  return "Outras";
}

export async function fetchFollowersFromSupabase() {
  try {
    const followers = await fetchAllLeadsFromSupabase();
    return {
      followers,
      following: followers.slice(0, 25),
      total_followers: followers.length,
      total_following: Math.min(25, followers.length)
    };
  } catch (e) {
    console.error("Error in fetchFollowersFromSupabase:", e);
    throw e;
  }
}

export async function fetchFollowers() {
  try {
    const res = await fetch(`${getApiBase()}/api/followers`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch followers');
    return await res.json();
  } catch (err) {
    console.warn('API error, attempting Supabase direct connection...', err);
    try {
      return await fetchFollowersFromSupabase();
    } catch (sbErr) {
      console.error('Supabase fetch error, generating mock followers list:', sbErr);
      const mockFollowers = Array.from({ length: 50 }, (_, i) => ({
        username: `seguidor_mock_${i + 1}`,
        timestamp: Date.now() - i * 3600000,
        followed_back: i % 2 === 0,
        gender: i % 2 === 0 ? "Mulheres" : "Homens",
        age_group: i % 4 === 0 ? "Criança" : i % 4 === 1 ? "Jovem" : i % 4 === 2 ? "Adulto" : "Idoso",
        city: i % 5 === 0 ? "Almenara" : i % 5 === 1 ? "Belo Horizonte" : i % 5 === 2 ? "Araçuaí" : "Outras"
      }));
      return {
        followers: mockFollowers,
        following: mockFollowers.slice(0, 25),
        total_followers: 50,
        total_following: 25
      };
    }
  }
}

export async function startBot(config: any) {
  const res = await fetch(`${getApiBase()}/api/bot/start`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(config)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to start bot');
  }
  return await res.json();
}

export async function stopBot() {
  const res = await fetch(`${getApiBase()}/api/bot/stop`, {
    method: 'POST',
    headers: getHeaders()
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to stop bot');
  }
  return await res.json();
}

export async function fetchBotStatus() {
  try {
    const res = await fetch(`${getApiBase()}/api/bot/status`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch bot status');
    return await res.json();
  } catch (err) {
    return {
      status: 'offline',
      progress: { current: 0, total: 0, current_user: '' },
      logs: ['[SISTEMA] Backend offline. Conecte o servidor Python local para usar o robô de disparo.']
    };
  }
}

export async function fetchSavedAccounts() {
  const res = await fetch(`${getApiBase()}/api/accounts`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch saved accounts');
  return await res.json();
}

export async function addSavedAccount(account: any) {
  const res = await fetch(`${getApiBase()}/api/accounts`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(account)
  });
  if (!res.ok) throw new Error('Failed to save account');
  return await res.json();
}

export async function deleteSavedAccount(username: string) {
  const res = await fetch(`${getApiBase()}/api/accounts/${username}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete account');
  return await res.json();
}

export async function fetchConnectionInfo() {
  const res = await fetch(`${getApiBase()}/api/connection-info`);
  if (!res.ok) throw new Error('Failed to fetch connection info');
  return await res.json();
}

export async function syncInstagram(username?: string) {
  const res = await fetch(`${getApiBase()}/api/sync`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ username })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Falha ao sincronizar dados');
  }
  return await res.json();
}
