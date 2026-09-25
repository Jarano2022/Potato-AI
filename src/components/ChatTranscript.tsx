import React, { useState } from 'react';
import { Volume2, Copy, Check, Trash2, Terminal, Loader2, Sparkles } from 'lucide-react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  toolsUsed?: Array<{
    name: string;
    input?: any;
    output?: any;
  }>;
}

export interface StreamingState {
  content: string;
  state?: string;
  activeTool?: {
    name: string;
    input?: any;
    status: 'running' | 'completed';
  } | null;
}

interface ChatTranscriptProps {
  messages: ChatMessage[];
  onReplayAudio: (msg: ChatMessage) => void;
  onClearHistory: () => void;
  isSpeaking: boolean;
  streaming?: StreamingState | null;
}

export const ChatTranscript: React.FC<ChatTranscriptProps> = ({
  messages,
  onReplayAudio,
  onClearHistory,
  isSpeaking,
  streaming,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const hasMessages = messages.length > 0 || Boolean(streaming);
  if (!hasMessages) return null;

  return (
    <div className="w-full space-y-3 pt-2">
      <div className="flex items-center justify-between text-[11px] font-mono text-stone-500 px-1">
        <span>Conversación en Vivo (Hermes Agent)</span>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="hover:text-stone-300 transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            <span>Limpiar</span>
          </button>
        )}
      </div>

      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
        {messages.map((msg) => {
          const isAssistant = msg.role === 'assistant';
          return (
            <div
              key={msg.id}
              className={`p-3.5 rounded-xl border text-xs leading-relaxed transition-all ${
                isAssistant
                  ? 'bg-[#111111] border-white/5 text-stone-200'
                  : 'bg-transparent border-white/5 text-stone-400'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-stone-500 mb-1.5">
                <span className={isAssistant ? 'text-orange-400 font-medium' : 'text-stone-400'}>
                  {isAssistant ? 'Hermes' : 'Tú'}
                </span>

                <div className="flex items-center gap-2">
                  <span>{msg.timestamp}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(msg.id, msg.content)}
                    className="hover:text-stone-300"
                    title="Copiar texto"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                  {isAssistant && (
                    <button
                      type="button"
                      onClick={() => onReplayAudio(msg)}
                      className="hover:text-orange-400"
                      title="Repetir voz"
                    >
                      <Volume2 className="w-3 h-3 text-orange-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* Tools invoked during this turn */}
              {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                <div className="mb-2 space-y-1">
                  {msg.toolsUsed.map((tool, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-[10px] font-mono text-orange-300 mr-1.5"
                    >
                      <Terminal className="w-2.5 h-2.5" />
                      <span>{tool.name}</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="font-sans whitespace-pre-wrap">{msg.content}</p>
            </div>
          );
        })}

        {/* Live Streaming Turn from Hermes WebSocket */}
        {streaming && (
          <div className="p-3.5 rounded-xl border border-orange-500/30 bg-[#141210] text-xs leading-relaxed transition-all animate-in fade-in duration-100">
            <div className="flex items-center justify-between text-[10px] font-mono text-orange-400 mb-2">
              <span className="font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
                Hermes en vivo (Streaming)
              </span>
              <span className="text-stone-500">JSON-RPC 2.0</span>
            </div>

            {/* Agent State or Tool Activity Banner */}
            {(streaming.state || streaming.activeTool) && (
              <div className="mb-2 p-2 rounded-lg bg-black/40 border border-orange-500/20 flex items-center gap-2 text-[11px] font-mono text-orange-300">
                {streaming.activeTool ? (
                  <>
                    <Terminal className="w-3 h-3 animate-spin text-orange-400" />
                    <span>
                      Ejecutando herramienta:{' '}
                      <strong className="text-white">{streaming.activeTool.name}</strong>
                    </span>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-orange-400" />
                    <span>{streaming.state || 'Pensando...'}</span>
                  </>
                )}
              </div>
            )}

            {/* Streamed text with blinking cursor */}
            <p className="font-sans text-stone-200 whitespace-pre-wrap">
              {streaming.content}
              <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-orange-400 animate-pulse align-middle" />
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
