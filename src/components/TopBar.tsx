import React from 'react';
import { Settings, Radio, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import { HermesWsStatus } from '../utils/hermesWsClient.ts';

interface TopBarProps {
  onOpenSettings: () => void;
  provider: string;
  wsStatus?: HermesWsStatus;
  wsUrl?: string;
  onReconnectWs?: () => void;
  isOnline?: boolean;
  isRemoteInsecure?: boolean;
  onOpenRemoteMicHelp?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenSettings,
  provider,
  wsStatus = 'disconnected',
  wsUrl = '',
  onReconnectWs,
  isOnline = true,
  isRemoteInsecure = false,
  onOpenRemoteMicHelp,
}) => {
  const isWsMode = provider === 'hermes_ws_agent';

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

        {/* Status & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Insecure Remote Mic Warning Badge */}
          {isRemoteInsecure && onOpenRemoteMicHelp && (
            <button
              type="button"
              onClick={onOpenRemoteMicHelp}
              className="px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[11px] font-mono flex items-center gap-1.5 hover:bg-amber-500/20 transition-all animate-pulse"
              title="Haz clic para ver cómo activar el micrófono en este dispositivo remoto"
            >
              <ShieldAlert className="w-3 h-3 text-amber-400" />
              <span>Activar micro en IP</span>
            </button>
          )}

          {/* Live Hermes Serve WebSocket Badge */}
          {isWsMode ? (
            <button
              type="button"
              onClick={onReconnectWs || onOpenSettings}
              title={`Hermes Serve WebSocket: ${wsUrl} (Haz clic para reconectar o configurar)`}
              className={`px-2.5 py-1 rounded-full border text-[11px] font-mono flex items-center gap-1.5 transition-all ${
                wsStatus === 'connected'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                  : wsStatus === 'connecting'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                  : 'border-red-500/20 bg-red-500/10 text-stone-400 hover:text-stone-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  wsStatus === 'connected'
                    ? 'bg-emerald-400 animate-pulse'
                    : wsStatus === 'connecting'
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-red-400'
                }`}
              />
              <span>
                {wsStatus === 'connected'
                  ? 'hermes serve: online'
                  : wsStatus === 'connecting'
                  ? 'conectando ws...'
                  : 'hermes serve: reconectar'}
              </span>
            </button>
          ) : (
            <span className="text-[10px] font-mono text-stone-500 hidden sm:inline-block">
              HTTP REST
            </span>
          )}

          {/* Settings button */}
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
