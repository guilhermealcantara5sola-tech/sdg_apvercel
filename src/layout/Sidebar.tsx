import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Folder, 
  ChevronDown, 
  ChevronRight, 
  FileCode, 
  Settings, 
  LogOut, 
  X, 
  Files, 
  GitBranch, 
  Code,
  AlertTriangle
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const [activeActivity, setActiveActivity] = useState<'explorer' | 'git' | 'settings'>('explorer');
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [openEditorsOpen, setOpenEditorsOpen] = useState(true);

  const navItems = [
    { icon: FileCode, label: 'dashboard.tsx', path: '/' },
    { icon: FileCode, label: 'campaigns_config.json', path: '/broadcast' },
    { icon: FileCode, label: 'strategy_planner.py', path: '/analytics' },
    { icon: FileCode, label: 'account_automation.py', path: '/automation' },
  ];

  const handleLogout = () => {
    sessionStorage.removeItem('isAuthenticated');
    localStorage.removeItem('isAuthenticated');
    window.location.reload();
  };

  return (
    <aside className={`h-screen flex fixed inset-y-0 left-0 z-50 transform md:sticky md:translate-x-0 transition-transform duration-300 ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      {/* 1. VS CODE ACTIVITY BAR (FAR LEFT) */}
      <div className="w-14 bg-[#18181c] border-r border-[#2d2d34] flex flex-col justify-between items-center py-4 shrink-0 select-none">
        <div className="flex flex-col gap-5 w-full items-center">
          {/* Files Icon (Explorer) */}
          <button 
            onClick={() => setActiveActivity('explorer')}
            className={`p-2.5 rounded-lg transition-colors relative group ${
              activeActivity === 'explorer' ? 'text-purple-400 border-l-2 border-purple-500 rounded-l-none pl-2' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Explorer"
          >
            <Files size={22} />
          </button>

          {/* Git Icon */}
          <button 
            onClick={() => setActiveActivity('git')}
            className={`p-2.5 rounded-lg transition-colors relative group ${
              activeActivity === 'git' ? 'text-purple-400 border-l-2 border-purple-500 rounded-l-none pl-2' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Source Control"
          >
            <GitBranch size={22} />
            <span className="absolute top-1 right-1 bg-purple-600 text-[8px] text-white font-extrabold w-3.5 h-3.5 rounded-full flex items-center justify-center">1</span>
          </button>
        </div>

        <div className="flex flex-col gap-4 w-full items-center">
          {/* Settings Icon */}
          <button 
            onClick={() => setActiveActivity('settings')}
            className={`p-2.5 rounded-lg transition-colors ${
              activeActivity === 'settings' ? 'text-purple-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Manage Settings"
          >
            <Settings size={22} />
          </button>
        </div>
      </div>

      {/* 2. EXPLORER SIDEBAR PANEL (NEXT TO ACTIVITY BAR) */}
      <div className="w-56 bg-[#1e1e24] border-r border-[#2d2d34] flex flex-col justify-between select-none">
        
        {/* Top Section */}
        <div className="flex-1 flex flex-col overflow-y-auto scrollbar-thin">
          {/* Title */}
          <div className="px-4 py-2.5 border-b border-[#2d2d34] flex items-center justify-between text-zinc-400 uppercase tracking-wider text-[10px] font-bold">
            <span>Explorer: InstaManager</span>
            <button onClick={onClose} className="md:hidden text-zinc-500 hover:text-zinc-300">
              <X size={14} />
            </button>
          </div>

          {/* Open Editors Section */}
          <div className="border-b border-[#2d2d34]/60">
            <button 
              onClick={() => setOpenEditorsOpen(!openEditorsOpen)}
              className="w-full flex items-center gap-1 px-2 py-1.5 text-zinc-400 hover:text-zinc-200 text-[10px] font-black uppercase text-left tracking-wide"
            >
              {openEditorsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span>Open Editors</span>
            </button>
            
            {openEditorsOpen && (
              <div className="pl-4 pb-2 space-y-1 text-xs">
                {navItems.map((item) => (
                  <NavLink
                    key={item.path + '-open'}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-1 text-zinc-400 hover:text-zinc-100 ${
                        isActive ? 'text-purple-400 bg-zinc-800/40 font-semibold' : ''
                      }`
                    }
                  >
                    <item.icon size={13} className="text-zinc-500" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {/* Workspace Files Directory */}
          <div>
            <button 
              onClick={() => setExplorerOpen(!explorerOpen)}
              className="w-full flex items-center gap-1 px-2 py-1.5 text-zinc-400 hover:text-zinc-200 text-[10px] font-black uppercase text-left tracking-wide"
            >
              {explorerOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span>sdg-ap-workspace</span>
            </button>

            {explorerOpen && (
              <div className="pl-3 py-1 space-y-1">
                {/* Folder workspace */}
                <div className="flex items-center gap-1.5 px-2 py-1 text-zinc-400 text-xs">
                  <ChevronDown size={12} className="text-zinc-600" />
                  <Folder size={13} className="text-purple-400 fill-purple-400/10" />
                  <span className="font-semibold text-zinc-300">src/pages</span>
                </div>

                {/* Files inside folder */}
                <div className="pl-5 space-y-0.5">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors text-xs ${
                          isActive 
                            ? 'bg-purple-950/25 text-purple-300 border-l-2 border-purple-500 font-semibold' 
                            : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                        }`
                      }
                    >
                      <item.icon size={13} className="text-purple-500/80" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  ))}
                </div>

                {/* Other static files */}
                <div className="pl-5 pt-1 space-y-1 text-xs text-zinc-500">
                  <div className="flex items-center gap-2 px-3 py-1">
                    <Code size={13} />
                    <span>accounts.json</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1">
                    <Code size={13} />
                    <span>settings.json</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section */}
        {activeActivity === 'settings' ? (
          <div className="p-4 border-t border-[#2d2d34] space-y-1">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-950/20 w-full rounded-lg text-xs font-semibold transition-colors"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="p-4 border-t border-[#2d2d34] flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
            <AlertTriangle size={12} className="text-amber-500" />
            <span>sys: healthy</span>
          </div>
        )}

      </div>
    </aside>
  );
};

export default Sidebar;
