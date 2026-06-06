import React from 'react';
import { Bell, Search, User } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="relative w-96">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="Pesquisar..."
          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
        />
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors relative">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 border-2 border-white rounded-full"></span>
        </button>
        <div className="h-8 w-px bg-gray-200 mx-2"></div>
        <button className="flex items-center gap-2 hover:bg-gray-100 p-1 pr-3 rounded-full transition-colors">
          <div className="w-8 h-8 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 rounded-full flex items-center justify-center text-white p-0.5">
            <div className="bg-white rounded-full p-0.5">
              <div className="bg-gray-200 rounded-full w-full h-full flex items-center justify-center overflow-hidden">
                <User size={16} className="text-gray-400" />
              </div>
            </div>
          </div>
          <span className="text-sm font-medium text-gray-700">meu_perfil</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
