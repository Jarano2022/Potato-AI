import React from 'react';
import { Settings, Sparkles, Volume2, Shield } from 'lucide-react';

interface TopBarProps {
  onOpenSettings: () => void;
  provider: string;
  isOnline: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenSettings,
  provider,
  isOnline,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-orange-500/15 bg-stone-950/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3">
          <a
            href="#"
            className="flex items-center gap-2.5 text-xl sm:text-2xl font-bold font-syne tracking-tight text-white group"
          >
            <span className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/40 text-orange-400 group-hover:scale-105 transition-transform">
              <span className="text-lg">🥔</span>
            </span>
            <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">
              Potato
            </span>
          </a>
          <span className="hidden sm:inline-block text-xs font-mono text-orange-400/80 px-2 py-0.5 border-l border-stone-800 ml-1">
            Hermes Voice
          </span>
        </div>

        {/* Zone 2: Clean Text Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-mono text-stone-400">
          <a href="#cava-section" className="hover:text-orange-400 transition-colors">
            Visualizador Cava
          </a>
          <a href="#voice-section" className="hover:text-orange-400 transition-colors">
            Chat de Voz
          </a>
          <a href="#hermes-section" className="hover:text-orange-400 transition-colors">
            Motor Hermes
          </a>
          <a href="#telemetry-section" className="hover:text-orange-400 transition-colors">
            Telemetría Mono
          </a>
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenSettings}
            className="px-3.5 py-1.5 text-xs font-mono font-medium text-stone-200 bg-stone-900 hover:bg-stone-800 border border-orange-500/30 rounded-lg hover:border-orange-500 transition-all flex items-center gap-2 shadow-sm"
          >
            <Settings className="w-3.5 h-3.5 text-orange-400" />
            <span className="hidden sm:inline">Configuración</span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </button>
        </div>
      </div>
    </header>
  );
};
