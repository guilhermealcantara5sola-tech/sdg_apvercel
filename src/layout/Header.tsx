import React from 'react';
import { Search, Minimize2, Square, X } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  return (
    <header className="h-10 bg-[#18181c] border-b border-[#2d2d34] flex items-center justify-between px-4 sticky top-0 z-10 select-none">
      {/* Left Menu / Breadcrumbs */}
      <div className="flex items-center gap-3 text-xs text-zinc-400">
        <span className="font-semibold text-purple-400 text-sm hidden xs:inline tracking-wider">InstaManager Dev</span>
        <div className="hidden md:flex items-center gap-3 font-normal text-[11px] text-zinc-500">
          <span className="hover:text-zinc-300 cursor-pointer">File</span>
          <span className="hover:text-zinc-300 cursor-pointer">Edit</span>
          <span className="hover:text-zinc-300 cursor-pointer">Selection</span>
          <span className="hover:text-zinc-300 cursor-pointer">View</span>
          <span className="hover:text-zinc-300 cursor-pointer">Go</span>
          <span className="hover:text-zinc-300 cursor-pointer">Run</span>
          <span className="hover:text-zinc-300 cursor-pointer">Terminal</span>
          <span className="hover:text-zinc-300 cursor-pointer">Help</span>
        </div>
      </div>

      {/* Center Search / App Title */}
      <div className="flex items-center justify-center flex-1 max-w-lg relative mx-4">
        <div className="w-full flex items-center gap-1 bg-[#1e1e24] border border-[#2d2d34] hover:bg-zinc-800/80 rounded-md py-1 px-3 text-[10px] text-zinc-400 font-mono text-center cursor-pointer select-none">
          <Search size={10} className="text-zinc-500 shrink-0" />
          <span className="truncate mx-auto">InstaManager - Workspace File Editor (git: main*)</span>
        </div>
      </div>

      {/* Right Window Control Controls (Mock VS Code Controls) */}
      <div className="flex items-center gap-1 text-zinc-500 shrink-0">
        <button className="p-1.5 hover:bg-zinc-800 rounded transition-colors" title="Minimize">
          <Minimize2 size={12} />
        </button>
        <button className="p-1.5 hover:bg-zinc-800 rounded transition-colors" title="Maximize">
          <Square size={10} />
        </button>
        <button className="p-1.5 hover:bg-red-600/80 hover:text-white rounded transition-colors" title="Close">
          <X size={12} />
        </button>
      </div>
    </header>
  );
};

export default Header;
