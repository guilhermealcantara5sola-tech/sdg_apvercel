import React from 'react';
import { NavLink } from 'react-router-dom';
import { Send, Settings, LogOut, X } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navItems = [
    { icon: Send, label: 'Gestão de Campanhas', path: '/' },
  ];

  const handleLogout = () => {
    sessionStorage.removeItem('isAuthenticated');
    localStorage.removeItem('isAuthenticated');
    window.location.reload();
  };

  return (
    <aside className={`w-64 bg-white border-r border-gray-200 h-screen flex flex-col fixed inset-y-0 left-0 z-50 transform md:sticky md:translate-x-0 transition-transform duration-300 ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
        <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
          InstaManager
        </h1>
        <button onClick={onClose} className="md:hidden text-gray-500 hover:text-gray-700 p-1 rounded-lg">
          <X size={20} />
        </button>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
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
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-500 hover:bg-red-50 w-full transition-colors"
        >
          <LogOut size={20} />
          Sair
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
