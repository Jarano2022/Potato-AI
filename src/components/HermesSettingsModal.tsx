import React, { useState } from 'react';
import { X, Check, Key, RefreshCw, AlertCircle, ShieldCheck, ExternalLink, Bot, Cpu, Terminal, Laptop } from 'lucide-react';
import { testHermesDirectConnection, isPrivateNetworkAddress } from '../utils/hermesClient.ts';

export interface HermesConfig {
  provider: 'hermes_agent_lan' | 'hermes_agent_tailscale' | 'hermes_agent_local' | 'hermes_agent_nous_portal' | 'hermes_openrouter' | 'hermes_ollama' | 'hermes_custom';
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  handsFree: boolean;
  voiceName: string;
  barCount: number;
  sensitivity: number;
  themeColor: string; // solid hex or color
}

interface HermesSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: HermesConfig;
  onSave: (newConfig: HermesConfig) => void;
  availableVoices: SpeechSynthesisVoice[];
}

export const HermesSettingsModal: React.FC<HermesSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
  availableVoices,
}) => {
  const [draft, setDraft] = useState<HermesConfig>({ ...config });
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; isPrivateIssue?: boolean } | null>(null);

  if (!isOpen) return null;

  const isCloudEnvironment = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  const isPrivateEndpoint = isPrivateNetworkAddress(draft.endpoint);

  const handleProviderSelect = (provider: HermesConfig['provider']) => {
    let endpoint = draft.endpoint;
    let model = draft.model;
    let apiKey = draft.apiKey;

    if (provider === 'hermes_agent_lan') {
      endpoint = 'http://192.168.1.199:8642/v1/chat/completions';
      model = 'hermes-agent';
      apiKey = '2c0e16d8cb65e8a8e3733897a326009903ba77cefea321ee1354d224ec94';
    } else if (provider === 'hermes_agent_tailscale') {
      endpoint = 'http://100.94.150.43:8642/v1/chat/completions';
      model = 'hermes-agent';
      apiKey = '2c0e16d8cb65e8a8e3733897a326009903ba77cefea321ee1354d224ec94';
    } else if (provider === 'hermes_agent_local') {
      endpoint = 'http://127.0.0.1:8642/v1/chat/completions';
      model = 'hermes-agent';
      apiKey = apiKey || '2c0e16d8cb65e8a8e3733897a326009903ba77cefea321ee1354d224ec94';
    } else if (provider === 'hermes_agent_nous_portal') {
      endpoint = 'https://api.nousresearch.com/v1/chat/completions';
      model = 'hermes-3-llama-3.1-405b';
    } else if (provider === 'hermes_openrouter') {
      endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      model = 'nousresearch/hermes-3-llama-3.1-8b';
    } else if (provider === 'hermes_ollama') {
      endpoint = 'http://localhost:11434/v1/chat/completions';
      model = 'hermes3:latest';
    }

    setDraft({ ...draft, provider, endpoint, model, apiKey });
    setTestResult(null);
  };

  const handleTestHermes = async () => {
    setTestingConnection(true);
    setTestResult(null);

    try {
      const result = await testHermesDirectConnection(draft.endpoint, draft.apiKey, draft.model);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err.message || 'Error al conectar con la API de Hermes Agent.',
        isPrivateIssue: isPrivateEndpoint && isCloudEnvironment,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const colors = [
    { label: 'Naranja', hex: '#f97316' },
    { label: 'Ámbar', hex: '#f59e0b' },
    { label: 'Esmeralda', hex: '#10b981' },
    { label: 'Cian', hex: '#06b6d4' },
    { label: 'Violeta', hex: '#a855f7' },
    { label: 'Blanco', hex: '#f4f4f5' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg max-h-[92vh] flex flex-col bg-[#0e0e0e] border border-white/10 rounded-2xl shadow-2xl p-5 sm:p-6 text-stone-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2.5">
            <Bot className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold tracking-tight text-white font-syne">
              Ajustes de Hermes Agent & Visualizador
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-500 hover:text-stone-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div className="py-4 space-y-4 text-xs overflow-y-auto pr-1">
          {/* Cloud Environment warning if targeting private LAN or Tailscale IP */}
          {isCloudEnvironment && isPrivateEndpoint && (
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/25 text-stone-300 text-[11px] space-y-2">
              <div className="flex items-center gap-2 font-medium text-amber-300">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Ejecutando en la nube (AI Studio Cloud)</span>
              </div>
              <p className="leading-relaxed text-stone-300">
                Estás usando una dirección de red privada local (<span className="font-mono text-amber-200 font-semibold">{draft.endpoint.replace('/v1/chat/completions', '')}</span>). Ni Google Cloud ni un navegador HTTPS pueden acceder a tu PC directamente.
              </p>
              <div className="pt-2 border-t border-amber-500/15 text-stone-300 space-y-1">
                <div className="font-semibold text-amber-200">Para conectarte con Hermes en tu ordenador:</div>
                <div className="flex items-start gap-1.5 text-[10.5px]">
                  <Laptop className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>1. En tu PC:</strong> ejecuta <code className="bg-black/50 px-1 py-0.5 rounded text-orange-300 font-mono">npm run dev</code> y abre <code className="bg-black/50 px-1 py-0.5 rounded text-orange-300 font-mono">http://localhost:3000</code>.
                  </span>
                </div>
                <div className="flex items-start gap-1.5 text-[10.5px]">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>2. O desde el móvil/nube:</strong> crea un túnel público HTTPS en tu PC con <code className="bg-black/50 px-1 py-0.5 rounded text-cyan-300 font-mono">tailscale funnel 8642</code> o <code className="bg-black/50 px-1 py-0.5 rounded text-cyan-300 font-mono">cloudflared tunnel --url http://localhost:8642</code>.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Provider Selection */}
          <div>
            <label className="block text-[11px] font-mono text-stone-400 mb-2">
              Conexión
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'hermes_agent_tailscale', label: 'Hermes Tailscale', sub: '100.94.150.43:8642' },
                { id: 'hermes_agent_lan', label: 'Hermes Agent LAN', sub: '192.168.1.199:8642' },
                { id: 'hermes_agent_local', label: 'Hermes Local', sub: '127.0.0.1:8642' },
                { id: 'hermes_openrouter', label: 'OpenRouter', sub: 'Hermes 3 Cloud' },
                { id: 'hermes_ollama', label: 'Ollama Local', sub: 'localhost:11434' },
                { id: 'hermes_agent_nous_portal', label: 'Nous Portal', sub: 'api.nousresearch.com' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProviderSelect(p.id as any)}
                  className={`text-left p-2.5 rounded-xl border text-xs transition-colors ${
                    draft.provider === p.id
                      ? 'bg-orange-500/10 border-orange-500/60 text-orange-200'
                      : 'bg-[#141414] border-white/5 text-stone-400 hover:border-white/15'
                  }`}
                >
                  <div className="font-medium text-stone-200 truncate">{p.label}</div>
                  <div className="text-[10px] text-stone-500 font-mono mt-0.5 truncate">{p.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Endpoint and Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-stone-400 mb-1">
                Endpoint URL
              </label>
              <input
                type="text"
                value={draft.endpoint}
                onChange={(e) => setDraft({ ...draft, endpoint: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg bg-[#141414] border border-white/10 text-stone-200 font-mono text-[11px] focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-stone-400 mb-1">
                Modelo / Agente
              </label>
              <input
                type="text"
                value={draft.model}
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg bg-[#141414] border border-white/10 text-stone-200 font-mono text-[11px] focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* API Key */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-mono text-stone-400">
                API Key (opcional en local)
              </label>
            </div>
            <input
              type="password"
              value={draft.apiKey}
              onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
              placeholder={draft.provider === 'hermes_agent_local' ? 'API_SERVER_KEY (si la activaste)' : 'sk-...'}
              className="w-full px-3 py-1.5 rounded-lg bg-[#141414] border border-white/10 text-stone-200 font-mono text-[11px] focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Visualizer Color Selection (Single Color) */}
          <div>
            <label className="block text-[11px] font-mono text-stone-400 mb-2">
              Color Único del Cava (Sin cortes)
            </label>
            <div className="flex items-center gap-2">
              {colors.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setDraft({ ...draft, themeColor: c.hex })}
                  className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                    draft.themeColor === c.hex
                      ? 'border-white scale-110 shadow-sm'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.label}
                >
                  {draft.themeColor === c.hex && (
                    <Check className={`w-3.5 h-3.5 ${c.hex === '#f4f4f5' ? 'text-black' : 'text-white'}`} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Sensitivity & Bars */}
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <div className="flex justify-between text-[11px] text-stone-400 mb-1">
                <span>Sensibilidad:</span>
                <span className="font-mono text-orange-400">{draft.sensitivity.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="2.5"
                step="0.1"
                value={draft.sensitivity}
                onChange={(e) => setDraft({ ...draft, sensitivity: parseFloat(e.target.value) })}
                className="w-full accent-orange-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-stone-400 mb-1">
                <span>Barras Cava:</span>
                <span className="font-mono text-orange-400">{draft.barCount}</span>
              </div>
              <input
                type="range"
                min="24"
                max="64"
                step="4"
                value={draft.barCount}
                onChange={(e) => setDraft({ ...draft, barCount: parseInt(e.target.value) })}
                className="w-full accent-orange-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Test connection */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#141414] border border-white/5">
            <span className="text-[11px] text-stone-400">Probar conexión con Hermes</span>
            <button
              type="button"
              onClick={handleTestHermes}
              disabled={testingConnection}
              className="px-3 py-1 text-[11px] font-mono rounded bg-white/5 hover:bg-white/10 text-stone-300 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${testingConnection ? 'animate-spin' : ''}`} />
              <span>{testingConnection ? 'Verificando...' : 'Ping'}</span>
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl text-[11px] space-y-1.5 ${
                testResult.ok
                  ? 'bg-emerald-950/40 border border-emerald-500/20 text-emerald-300'
                  : 'bg-red-950/40 border border-red-500/20 text-red-300'
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                {testResult.ok ? (
                  <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                )}
                <span>{testResult.ok ? 'Conexión verificada exitosamente' : 'Error al conectar'}</span>
              </div>
              <div className="text-[10.5px] leading-relaxed text-stone-300 break-words font-mono">
                {testResult.message}
              </div>
              {!testResult.ok && (
                <div className="pt-2 border-t border-white/10 text-[10.5px] text-stone-300 space-y-1">
                  <div className="font-semibold text-orange-300">💡 Cómo resolverlo:</div>
                  <div className="text-stone-400 leading-normal">
                    1. Si estás probando desde el navegador de tu móvil o desde AI Studio Cloud, los servidores de Google no pueden ver tu IP privada ({draft.endpoint.replace('/v1/chat/completions', '')}).
                  </div>
                  <div className="text-stone-400 leading-normal">
                    2. <strong>En tu PC:</strong> ejecuta <code className="text-orange-300 font-mono">npm run dev</code> y entra en <code className="text-orange-300 font-mono">http://localhost:3000</code>.
                  </div>
                  <div className="text-stone-400 leading-normal">
                    3. <strong>O para usarlo desde cualquier sitio:</strong> en tu PC ejecuta <code className="text-cyan-300 font-mono">tailscale funnel 8642</code> o <code className="text-cyan-300 font-mono">cloudflared tunnel --url http://localhost:8642</code> y pon la dirección HTTPS que te proporcione.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};
