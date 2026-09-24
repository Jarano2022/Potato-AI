import React from 'react';
import { Settings } from 'lucide-react';

interface TopBarProps {
  onOpenSettings: () => void;
  provider: string;
  isOnline: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenSettings,
}) => {
  return (
    <header className="w-full border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur-md">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <span className="text-base select-none">🥔</span>
          <span className="font-semibold text-sm tracking-tight text-stone-100 font-syne">
            Potato
          </span>
          <span className="text-[11px] font-mono text-stone-500">
            / hermes-agent
          </span>
        </div>

        {/* Minimal Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenSettings}
            className="px-2.5 py-1.5 text-xs font-mono text-stone-400 hover:text-stone-200 hover:bg-white/5 rounded-lg border border-white/5 transition-colors flex items-center gap-1.5"
          >
            <Settings className="w-3.5 h-3.5 text-orange-400" />
            <span>Ajustes</span>
          </button>
        </div>
      </div>
    </header>
  );
};
