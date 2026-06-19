import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { GitBranch, RefreshCw } from 'lucide-react';

const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-[#09090b] text-[#f4f4f5] select-none overflow-hidden">
      
      {/* VS Code title bar */}
      <Header onMenuClick={() => setSidebarOpen(true)} />
      
      <div className="flex-1 flex overflow-hidden">
        {/* VS Code Activity Bar & Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        {sidebarOpen && (
          <div 
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
          />
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <main className="p-4 sm:p-6 flex-1 flex flex-col">
            <Outlet />
          </main>
        </div>
      </div>

      {/* VS Code Status Bar (Purple dev status bar at the bottom) */}
      <footer className="h-6 bg-purple-700 text-purple-100 flex items-center justify-between px-3 text-[10px] font-mono select-none tracking-wide">
        <div className="flex items-center gap-3">
          {/* Git branch info */}
          <div className="flex items-center gap-1 hover:bg-purple-800 px-2 py-0.5 rounded cursor-pointer">
            <GitBranch size={11} />
            <span>main*</span>
          </div>
          {/* Sync indicator */}
          <div className="flex items-center gap-1 hover:bg-purple-800 px-2 py-0.5 rounded cursor-pointer">
            <RefreshCw size={10} className="animate-spin" />
            <span>Local Server Active</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="hover:bg-purple-800 px-2 py-0.5 rounded cursor-pointer">Ln 14, Col 35</span>
          <span className="hover:bg-purple-800 px-2 py-0.5 rounded cursor-pointer">Spaces: 2</span>
          <span className="hover:bg-purple-800 px-2 py-0.5 rounded cursor-pointer">UTF-8</span>
          <span className="hover:bg-purple-800 px-2 py-0.5 rounded cursor-pointer">TypeScript JSX</span>
        </div>
      </footer>

    </div>
  );
};

export default MainLayout;
