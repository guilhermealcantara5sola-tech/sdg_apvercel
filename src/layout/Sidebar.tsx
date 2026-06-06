import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Image, BarChart3, MessageSquare, Send, Settings, LogOut } from 'lucide-react';

const Sidebar: React.FC = () => {
  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Image, label: 'Posts', path: '/posts' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: MessageSquare, label: 'Interações', path: '/inbox' },
    { icon: Send, label: 'Disparo Automático', path: '/broadcast' },
  ];


  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col sticky top-0">
      <div className="p-6 border-b border-gray-100">
        <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
          InstaManager
        </h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-purple-50 text-purple-600 font-medium' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`
            }
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100 space-y-1">
        <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 w-full transition-colors">
          <Settings size={20} />
          Configurações
        </button>
        <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-500 hover:bg-red-50 w-full transition-colors">
          <LogOut size={20} />
          Sair
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
