import React from 'react';
import { Cpu, HardDrive, Radio, Mic, Zap, ShieldCheck } from 'lucide-react';

interface AudioStatsWidgetProps {
  modelName: string;
  provider: string;
  latencyMs: number;
  isMicActive: boolean;
  isSpeaking: boolean;
  sampleRate: number;
  dbLevel: number;
}

export const AudioStatsWidget: React.FC<AudioStatsWidgetProps> = ({
  modelName,
  provider,
  latencyMs,
  isMicActive,
  isSpeaking,
  sampleRate,
  dbLevel,
}) => {
  // Normalize dB for progress bar (-90dB to 0dB)
  const normDb = Math.min(100, Math.max(0, Math.round(((dbLevel + 90) / 90) * 100)));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
      {/* Widget 1: Monitor de Motor Hermes & CPU/Latencia */}
      <div className="rounded-xl bg-stone-900/80 border border-orange-500/20 p-3 shadow-lg font-mono text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-orange-500/10 text-stone-300">
          <div className="flex items-center gap-1.5 font-semibold text-orange-400">
            <Radio className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
            <span>Monitor Enlace Hermes</span>
          </div>
          <span className="text-orange-300 font-semibold tabular-nums">
            {latencyMs > 0 ? `${latencyMs} ms` : 'Standby'}
          </span>
        </div>

        <div className="mt-2.5 space-y-1.5 text-stone-400">
          <div className="flex justify-between items-center">
            <span className="text-stone-500">Modelo:</span>
            <span className="text-stone-200 truncate max-w-[150px] font-medium" title={modelName}>
              {modelName.split('/').pop()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-stone-500">Proveedor:</span>
            <span className="text-orange-300 capitalize">
              {provider.replace('hermes_', '').replace('potato_', '')}
            </span>
          </div>

          {/* Micro sparkline */}
          <div className="pt-1.5">
            <div className="flex justify-between text-[10px] text-stone-500 mb-1">
              <span>Actividad red</span>
              <span className="text-orange-400">{isSpeaking || isMicActive ? 'Transfiriendo' : 'Reposo'}</span>
            </div>
            <div className="h-2 w-full bg-stone-950 rounded-full overflow-hidden border border-orange-500/15">
              <div
                className="h-full bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-400 transition-all duration-300"
                style={{
                  width: isSpeaking ? '85%' : isMicActive ? '65%' : '15%',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Widget 2: Estado de Audio Mono & Micrófono */}
      <div className="rounded-xl bg-stone-900/80 border border-orange-500/20 p-3 shadow-lg font-mono text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-orange-500/10 text-stone-300">
          <div className="flex items-center gap-1.5 font-semibold text-orange-400">
            <Mic className="w-3.5 h-3.5 text-orange-500" />
            <span>Canal Audio Mono</span>
          </div>
          <span className="text-orange-300 font-semibold tabular-nums">
            {sampleRate ? `${(sampleRate / 1000).toFixed(1)} kHz` : '48.0 kHz'}
          </span>
        </div>

        <div className="mt-2.5 space-y-1.5 text-stone-400">
          <div className="flex justify-between items-center">
            <span className="text-stone-500">Canal:</span>
            <span className="text-orange-300 font-medium">1.0 Mono (Cava EQ)</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-stone-500">Nivel pico:</span>
            <span className="text-stone-200 tabular-nums">
              {dbLevel > -85 ? `${dbLevel} dB` : '-∞ dB'}
            </span>
          </div>

          {/* VU Meter bar */}
          <div className="pt-1.5">
            <div className="flex justify-between text-[10px] text-stone-500 mb-1">
              <span>Ganancia entrada</span>
              <span className="text-orange-400">{normDb}%</span>
            </div>
            <div className="h-2 w-full bg-stone-950 rounded-full overflow-hidden border border-orange-500/15">
              <div
                className="h-full bg-gradient-to-r from-orange-600 via-orange-400 to-amber-300 transition-all duration-75"
                style={{ width: `${normDb}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
