import React, { useState, useEffect } from 'react';
import { fetchChats, fetchChatMessages } from '../utils/api';
import { Search, Send, Smile, Paperclip, MoreVertical, Phone, Video } from 'lucide-react';

const Inbox: React.FC = () => {
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [chatDetails, setChatDetails] = useState<any>(null);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    async function loadChats() {
      try {
        const chatsList = await fetchChats();
        setChats(chatsList);
        if (chatsList.length > 0) {
          setSelectedChat(chatsList[0]);
        }
      } catch (err) {
        console.error('Error loading chats:', err);
      } finally {
        setLoadingChats(false);
      }
    }
    loadChats();
  }, []);

  useEffect(() => {
    if (!selectedChat) return;

    async function loadMessages() {
      setLoadingMessages(true);
      try {
        const details = await fetchChatMessages(selectedChat.id);
        setChatDetails(details);
      } catch (err) {
        console.error('Error loading chat messages:', err);
      } finally {
        setLoadingMessages(false);
      }
    }
    loadMessages();
  }, [selectedChat]);

  const filteredChats = chats.filter(chat => 
    chat.sender.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isCandidate = (senderName: string) => {
    const name = senderName.toLowerCase();
    return name.includes('thenperson') || name.includes('oriebir');
  };

  if (loadingChats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] bg-white rounded-2xl border border-gray-100 shadow-sm flex overflow-hidden">
      {/* Sidebar - Chat List */}
      <div className="w-80 border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Mensagens</h2>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Pesquisar conversas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredChats.map((msg) => (
            <button
              key={msg.id}
              onClick={() => setSelectedChat(msg)}
              className={`w-full p-4 flex gap-3 hover:bg-gray-50 transition-colors border-l-4 ${
                selectedChat && selectedChat.id === msg.id ? 'bg-purple-50/50 border-purple-500' : 'border-transparent'
              }`}
            >
              <img src={msg.avatar} alt={msg.sender} className="w-12 h-12 rounded-full border-2 border-white shadow-sm bg-purple-100" />
              <div className="flex-1 text-left min-w-0">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-gray-800 text-sm truncate">@{msg.sender}</span>
                  <span className="text-[10px] text-gray-400 truncate max-w-[60px]">{msg.time.split(' ')[0]}</span>
                </div>
                <p className={`text-xs truncate mt-0.5 ${msg.unread ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
                  {msg.lastMessage}
                </p>
              </div>
              {msg.unread && (
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-50/30">
        {selectedChat && chatDetails ? (
          <>
            {/* Chat Header */}
            <div className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <img src={selectedChat.avatar} alt={selectedChat.sender} className="w-10 h-10 rounded-full bg-purple-100" />
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">@{selectedChat.sender}</h3>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Histórico Real</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-gray-400">
                <button className="hover:text-purple-600 transition-colors"><Phone size={20} /></button>
                <button className="hover:text-purple-600 transition-colors"><Video size={20} /></button>
                <button className="hover:text-purple-600 transition-colors"><MoreVertical size={20} /></button>
              </div>
            </div>

            {/* Messages Container */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600"></div>
                </div>
              ) : (
                <>
                  <div className="flex justify-center">
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full uppercase tracking-widest">
                      Conversa Histórica
                    </span>
                  </div>

                  {chatDetails.messages.map((msg: any, idx: number) => {
                    const isMe = isCandidate(msg.sender);
                    return (
                      <div 
                        key={idx} 
                        className={`flex gap-3 max-w-[75%] ${isMe ? 'flex-row-reverse ml-auto' : 'mr-auto'}`}
                      >
                        {!isMe && (
                          <img src={selectedChat.avatar} alt="" className="w-8 h-8 rounded-full self-end bg-purple-100" />
                        )}
                        <div className={`p-4 rounded-2xl shadow-sm border ${
                          isMe 
                            ? 'bg-purple-600 text-white border-purple-500 rounded-br-none' 
                            : 'bg-white text-gray-700 border-gray-100 rounded-bl-none'
                        }`}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          <span className={`text-[9px] mt-2 block ${isMe ? 'text-purple-200 text-right' : 'text-gray-400'}`}>
                            {msg.date} às {msg.time}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 bg-white border-t border-gray-100">
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2 border border-gray-100">
                <button className="text-gray-400 hover:text-purple-600 transition-colors"><Smile size={20} /></button>
                <button className="text-gray-400 hover:text-purple-600 transition-colors"><Paperclip size={20} /></button>
                <input
                  type="text"
                  placeholder="Responder (Somente visualização do histórico)..."
                  disabled
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-gray-400 cursor-not-allowed"
                />
                <button disabled className="bg-purple-300 text-white p-2 rounded-lg cursor-not-allowed shadow-sm">
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <p className="text-lg">Nenhuma conversa selecionada</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inbox;

