import React, { useState } from 'react';
import { X, Check, Server, Key, Sliders, Volume2, ShieldCheck, RefreshCw, AlertCircle, Sparkles, ExternalLink, Globe, Bot, Cpu } from 'lucide-react';
import { testHermesDirectConnection } from '../utils/hermesClient.ts';

export interface HermesConfig {
  provider: 'hermes_agent_local' | 'hermes_agent_nous_portal' | 'hermes_openrouter' | 'hermes_ollama' | 'hermes_custom';
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  handsFree: boolean;
  voiceName: string;
  barCount: number;
  sensitivity: number;
  themeColor: 'orange' | 'amber' | 'ember';
  styleType: 'solid' | 'segmented';
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
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; direct?: boolean } | null>(null);

  if (!isOpen) return null;

  const handleProviderSelect = (provider: HermesConfig['provider']) => {
    let endpoint = draft.endpoint;
    let model = draft.model;
    let apiKey = draft.apiKey;

    if (provider === 'hermes_agent_local') {
      // Official Hermes Agent default API Server: http://127.0.0.1:8642/v1
      endpoint = 'http://127.0.0.1:8642/v1/chat/completions';
      model = 'hermes-agent';
    } else if (provider === 'hermes_agent_nous_portal') {
      // Nous Portal / Hermes Gateway
      endpoint = 'https://api.nousresearch.com/v1/chat/completions';
      model = 'hermes-3-llama-3.1-405b';
    } else if (provider === 'hermes_openrouter') {
      endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      model = 'nousresearch/hermes-3-llama-3.1-8b';
    } else if (provider === 'hermes_ollama') {
      endpoint = 'http://localhost:11434/v1/chat/completions';
      model = 'hermes3:latest';
    } else if (provider === 'hermes_custom') {
      endpoint = 'https://api.together.xyz/v1/chat/completions';
      model = 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO';
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
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-stone-900 border border-orange-500/30 rounded-2xl shadow-2xl p-6 text-stone-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-orange-500/15">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-syne text-white flex items-center gap-2">
                <span>Conexión con Hermes Agent</span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  hermes-agent.ai
                </span>
              </h2>
              <p className="text-xs text-stone-400">
                Este frontend se conecta directamente a la API de tu agente Hermes (local o nube)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-5 space-y-6">
          {/* Provider Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-orange-400 uppercase tracking-wider">
                Servidor de Hermes Agent
              </label>
              <a
                href="https://hermes-agent.ai/"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-mono text-orange-400/80 hover:text-orange-300 flex items-center gap-1 hover:underline"
              >
                <span>Documentación oficial hermes-agent.ai</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                {
                  id: 'hermes_agent_local',
                  label: 'Hermes Agent Local',
                  desc: 'http://127.0.0.1:8642/v1 (API_SERVER_ENABLED=true)',
                  tag: 'hermes-agent.ai',
                },
                {
                  id: 'hermes_agent_nous_portal',
                  label: 'Nous Portal Gateway',
                  desc: 'api.nousresearch.com/v1 (Hermes Agent Cloud)',
                  tag: 'Nube Oficial',
                },
                {
                  id: 'hermes_openrouter',
                  label: 'Hermes 3 (OpenRouter)',
                  desc: 'openrouter.ai/api/v1 (Nous Hermes 3)',
                  tag: 'Cloud Fallback',
                },
                {
                  id: 'hermes_ollama',
                  label: 'Hermes Ollama',
                  desc: 'localhost:11434/v1 (hermes3:latest)',
                  tag: 'Ollama local',
                },
              ].map((p) => {
                const isSelected = draft.provider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProviderSelect(p.id as any)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-orange-500/15 border-orange-500 text-orange-200 shadow-md shadow-orange-950/40'
                        : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:border-stone-700 hover:text-stone-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-stone-100">{p.label}</div>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-orange-400">
                        {p.tag}
                      </span>
                    </div>
                    <div className="text-[10px] text-stone-500 mt-1 font-mono truncate">{p.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Guide for hermes-agent.ai local server */}
          {draft.provider === 'hermes_agent_local' && (
            <div className="p-3.5 rounded-xl bg-orange-950/20 border border-orange-500/25 text-xs text-stone-300 font-mono space-y-1.5">
              <div className="text-orange-400 font-semibold flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" />
                <span>¿Cómo activar el API Server en Hermes Agent?</span>
              </div>
              <p className="text-[11px] text-stone-400">
                En tu instalación de Hermes Agent (<code className="text-orange-300">~/.hermes/.env</code>):
              </p>
              <pre className="p-2 rounded bg-black/60 border border-stone-800 text-[11px] text-emerald-400 overflow-x-auto">
{`API_SERVER_ENABLED=true
API_SERVER_HOST=0.0.0.0
API_SERVER_PORT=8642
API_SERVER_KEY=tu_clave_secreta (opcional)`}
              </pre>
              <p className="text-[10px] text-stone-500">
                Luego inicia tu agente (<code className="text-stone-300">hermes</code> o <code className="text-stone-300">hermes agent</code>) y este frontend se comunicará directo con él.
              </p>
            </div>
          )}

          {/* Endpoint and Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-stone-400 mb-1.5">
                API Endpoint (URL del servidor)
              </label>
              <input
                type="text"
                value={draft.endpoint}
                onChange={(e) => setDraft({ ...draft, endpoint: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-stone-950 border border-stone-800 text-stone-200 focus:outline-none focus:border-orange-500"
                placeholder="http://127.0.0.1:8642/v1/chat/completions"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-stone-400 mb-1.5">
                Modelo o Perfil del Agente
              </label>
              <input
                type="text"
                value={draft.model}
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-stone-950 border border-stone-800 text-stone-200 focus:outline-none focus:border-orange-500"
                placeholder="hermes-agent"
              />
            </div>
          </div>

          {/* API Key */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-mono text-stone-400 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-orange-400" />
                API Key (API_SERVER_KEY o token de proveedor)
              </label>
              <span className="text-[10px] text-stone-500">
                {draft.provider === 'hermes_agent_local' || draft.provider === 'hermes_ollama'
                  ? 'Opcional si tu servidor local no tiene contraseña'
                  : 'Requerida para proveedores en la nube'}
              </span>
            </div>
            <input
              type="password"
              value={draft.apiKey}
              onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
              className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-stone-950 border border-stone-800 text-stone-200 focus:outline-none focus:border-orange-500"
              placeholder={draft.provider === 'hermes_agent_local' ? 'API_SERVER_KEY (si la definiste)' : 'sk-...'}
            />
          </div>

          {/* Test Connection Button & Result */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-stone-950/70 border border-orange-500/15">
            <div className="text-xs">
              <span className="font-semibold text-stone-300">Probar enlace con Hermes Agent:</span>
              <p className="text-[11px] text-stone-500">Comprueba si el endpoint responde con un ping inmediato</p>
            </div>
            <button
              type="button"
              onClick={handleTestHermes}
              disabled={testingConnection}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
              {testingConnection ? 'Probando...' : 'Verificar Conexión'}
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                testResult.ok
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-950/40 border-red-500/30 text-red-300'
              }`}
            >
              {testResult.ok ? <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Audio Visualizer Cava Controls */}
          <div>
            <label className="block text-xs font-semibold text-orange-400 uppercase tracking-wider mb-2">
              Ajustes del Visualizador Cava (Mono)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-stone-950/60 border border-stone-800">
              <div>
                <div className="flex justify-between text-xs text-stone-400 mb-1">
                  <span>Número de Barras:</span>
                  <span className="text-orange-400 font-mono font-semibold">{draft.barCount}</span>
                </div>
                <input
                  type="range"
                  min="24"
                  max="64"
                  step="2"
                  value={draft.barCount}
                  onChange={(e) => setDraft({ ...draft, barCount: parseInt(e.target.value) })}
                  className="w-full accent-orange-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-stone-400 mb-1">
                  <span>Sensibilidad Audio:</span>
                  <span className="text-orange-400 font-mono font-semibold">{draft.sensitivity.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="3.0"
                  step="0.1"
                  value={draft.sensitivity}
                  onChange={(e) => setDraft({ ...draft, sensitivity: parseFloat(e.target.value) })}
                  className="w-full accent-orange-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-stone-400 mb-1">
                  <span>Estilo de Barra:</span>
                  <span className="text-orange-400 font-mono font-semibold capitalize">{draft.styleType}</span>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, styleType: 'solid' })}
                    className={`flex-1 py-1 text-xs rounded border text-center transition-colors ${
                      draft.styleType === 'solid' ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'border-stone-800 text-stone-500'
                    }`}
                  >
                    Sólido
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, styleType: 'segmented' })}
                    className={`flex-1 py-1 text-xs rounded border text-center transition-colors ${
                      draft.styleType === 'segmented' ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'border-stone-800 text-stone-500'
                    }`}
                  >
                    Segmentado
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Voice Selector */}
          <div>
            <label className="block text-xs font-semibold text-orange-400 uppercase tracking-wider mb-2">
              Voz de Salida (TTS del Navegador)
            </label>
            <select
              value={draft.voiceName}
              onChange={(e) => setDraft({ ...draft, voiceName: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg bg-stone-950 border border-stone-800 text-stone-200 focus:outline-none focus:border-orange-500"
            >
              <option value="">Voz automática (Español recomendado)</option>
              {availableVoices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-orange-500/15">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-stone-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg shadow-lg shadow-orange-950/50 transition-colors flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Guardar Configuración
          </button>
        </div>
      </div>
    </div>
  );
};
