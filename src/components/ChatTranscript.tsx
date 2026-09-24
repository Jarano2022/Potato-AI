import React from 'react';
import { Volume2, Copy, Check, Trash2, Bot, User, Sparkles } from 'lucide-react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  audioBase64?: string;
}

interface ChatTranscriptProps {
  messages: ChatMessage[];
  onReplayAudio: (msg: ChatMessage) => void;
  onClearHistory: () => void;
  isSpeaking: boolean;
}

export const ChatTranscript: React.FC<ChatTranscriptProps> = ({
  messages,
  onReplayAudio,
  onClearHistory,
  isSpeaking,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (messages.length === 0) {
    return (
      <div className="w-full py-8 px-4 rounded-2xl bg-stone-900/40 border border-stone-800/80 text-center text-stone-500 font-mono text-xs">
        <Bot className="w-8 h-8 mx-auto mb-2 text-orange-500/60" />
        <p className="text-stone-400 font-medium">El historial de conversación está vacío</p>
        <p className="text-stone-600 mt-1">Presiona el botón del micrófono o prueba una pregunta para hablar con Hermes.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between px-2 text-xs font-mono text-stone-400">
        <div className="flex items-center gap-2">
          <span className="text-orange-400 font-semibold">Transcripción en Vivo</span>
          <span className="text-stone-600">·</span>
          <span>{messages.length} mensajes</span>
        </div>
        <button
          type="button"
          onClick={onClearHistory}
          className="hover:text-red-400 transition-colors flex items-center gap-1 text-[11px]"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Limpiar</span>
        </button>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {messages.map((msg) => {
          const isAssistant = msg.role === 'assistant';
          return (
            <div
              key={msg.id}
              className={`p-4 rounded-xl border transition-all ${
                isAssistant
                  ? 'bg-stone-900/90 border-orange-500/20 shadow-md shadow-orange-950/20'
                  : 'bg-stone-950/70 border-stone-800'
              }`}
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-800 text-xs font-mono">
                <div className="flex items-center gap-2">
                  {isAssistant ? (
                    <div className="flex items-center gap-1.5 text-orange-400 font-semibold">
                      <span className="text-base">🥔</span>
                      <span>Potato (Hermes)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-stone-400 font-semibold">
                      <User className="w-3.5 h-3.5 text-stone-500" />
                      <span>Tú</span>
                    </div>
                  )}
                  {msg.model && isAssistant && (
                    <span className="text-[10px] text-stone-500 bg-stone-950 px-2 py-0.5 rounded border border-stone-800">
                      {msg.model.split('/').pop()}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-stone-500 text-[11px]">
                  <span>{msg.timestamp}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(msg.id, msg.content)}
                    className="hover:text-stone-300 p-1"
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
                      className="hover:text-orange-400 p-1"
                      title="Reproducir de nuevo por voz"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-orange-400" />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-sm text-stone-200 leading-relaxed font-sans">
                {msg.content}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
