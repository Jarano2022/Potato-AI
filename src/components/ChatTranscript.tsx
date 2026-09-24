import React from 'react';
import { Volume2, Copy, Check, Trash2 } from 'lucide-react';

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
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (messages.length === 0) return null;

  return (
    <div className="w-full space-y-3 pt-2">
      <div className="flex items-center justify-between text-[11px] font-mono text-stone-500 px-1">
        <span>Conversación</span>
        <button
          type="button"
          onClick={onClearHistory}
          className="hover:text-stone-300 transition-colors flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          <span>Limpiar</span>
        </button>
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
                    title="Copiar"
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

              <p className="font-sans whitespace-pre-wrap">{msg.content}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
