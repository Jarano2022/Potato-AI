import React, { useState } from 'react';
import { Mic, Square, Send, Headphones, Volume2, Radio } from 'lucide-react';

interface VoiceControllerProps {
  isRecording: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  agentStatusText?: string;
  handsFree: boolean;
  interimTranscript: string;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onInterruptSpeech: () => void;
  onToggleHandsFree: () => void;
  onSendTextMessage: (text: string) => void;
  onRunAudioTest: () => void;
  isTestMode: boolean;
}

export const VoiceController: React.FC<VoiceControllerProps> = ({
  isRecording,
  isSpeaking,
  isThinking,
  agentStatusText,
  handsFree,
  interimTranscript,
  onStartRecording,
  onStopRecording,
  onInterruptSpeech,
  onToggleHandsFree,
  onSendTextMessage,
  onRunAudioTest,
  isTestMode,
}) => {
  const [typedText, setTypedText] = useState('');

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedText.trim()) return;
    onSendTextMessage(typedText);
    setTypedText('');
  };

  return (
    <div className="w-full flex flex-col items-center gap-6">
      {/* Central Voice Button */}
      <div className="relative flex flex-col items-center">
        <button
          type="button"
          onClick={() => {
            if (isSpeaking) {
              onInterruptSpeech();
            } else if (isRecording) {
              onStopRecording();
            } else {
              onStartRecording();
            }
          }}
          disabled={isThinking}
          className={`relative w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all duration-300 select-none focus:outline-none ${
            isSpeaking
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/40 scale-105'
              : isRecording
              ? 'bg-orange-600 text-white shadow-xl shadow-orange-950/60 scale-105 ring-2 ring-orange-500/40'
              : isThinking
              ? 'bg-stone-900 border border-stone-800 text-orange-400 cursor-wait'
              : 'bg-[#141414] hover:bg-[#1a1a1a] text-stone-200 border border-white/10 hover:border-orange-500/50 hover:scale-105'
          }`}
          title={
            isSpeaking
              ? 'Detener voz'
              : isRecording
              ? 'Detener y enviar'
              : 'Hablar con Hermes'
          }
        >
          {isSpeaking ? (
            <Square className="w-6 h-6 fill-current" />
          ) : isRecording ? (
            <Mic className="w-7 h-7 text-white animate-pulse" />
          ) : isThinking ? (
            <div className="w-6 h-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          ) : (
            <Mic className="w-7 h-7 text-orange-400" />
          )}

          <span className="text-[10px] font-mono tracking-wider text-stone-400 uppercase mt-1">
            {isSpeaking ? 'Parar' : isRecording ? 'Enviando' : isThinking ? 'Procesando' : 'Hablar'}
          </span>
        </button>

        {/* Minimal Subtitle */}
        <p className="mt-2.5 text-[11px] font-mono text-stone-500 text-center">
          {isSpeaking
            ? 'Hermes hablando · Clic para silenciar'
            : isRecording
            ? 'Escuchando tu voz...'
            : isThinking
            ? agentStatusText || 'Hermes pensando...'
            : 'Haz clic para hablar'}
        </p>
      </div>

      {/* Interim live speech feedback */}
      {interimTranscript && (
        <div className="w-full max-w-md px-4 py-2 rounded-xl bg-[#111111] border border-white/10 text-stone-200 text-xs font-mono flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-orange-400 shrink-0 animate-pulse" />
          <span className="text-stone-400 italic truncate">{interimTranscript}</span>
        </div>
      )}

      {/* Minimal controls row */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleHandsFree}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors flex items-center gap-1.5 ${
            handsFree
              ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
              : 'bg-[#111] border-white/5 text-stone-400 hover:text-stone-300'
          }`}
        >
          <Headphones className="w-3 h-3" />
          <span>Manos libres: {handsFree ? 'ON' : 'OFF'}</span>
        </button>

        <button
          type="button"
          onClick={onRunAudioTest}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors flex items-center gap-1.5 ${
            isTestMode
              ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
              : 'bg-[#111] border-white/5 text-stone-400 hover:text-stone-300'
          }`}
        >
          <Volume2 className="w-3 h-3" />
          <span>{isTestMode ? 'Detener Test' : 'Test Cava'}</span>
        </button>
      </div>

      {/* Minimal clean text input */}
      <form onSubmit={handleTextSubmit} className="w-full max-w-md flex items-center gap-2">
        <input
          id="voice-chat-text-input"
          type="text"
          value={typedText}
          onChange={(e) => setTypedText(e.target.value)}
          placeholder="O escribe un mensaje..."
          disabled={isThinking}
          className="flex-1 px-3.5 py-2 rounded-xl bg-[#111] border border-white/10 text-stone-200 text-xs placeholder:text-stone-600 focus:outline-none focus:border-orange-500/50 transition-colors"
        />
        <button
          type="submit"
          disabled={!typedText.trim() || isThinking}
          className="px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-xs transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
