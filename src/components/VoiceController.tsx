import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Square, Play, Sparkles, Send, Volume2, Headphones, Radio } from 'lucide-react';
import { speechEngine } from '../utils/speechEngine.ts';

interface VoiceControllerProps {
  isRecording: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
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

  const quickPrompts = [
    '¿Quién eres Potato y qué es Hermes?',
    'Explícame cómo funciona el audio mono en cava',
    'Cuéntame algo curioso en dos oraciones',
    'Dame una frase motivadora para hoy',
  ];

  return (
    <div className="w-full flex flex-col items-center gap-5">
      {/* Central Voice Control Hub */}
      <div className="relative flex flex-col items-center">
        {/* Animated Glow Rings when Active */}
        {(isRecording || isSpeaking || isThinking) && (
          <div className="absolute inset-0 -m-3 rounded-full bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 opacity-20 blur-xl animate-pulse pointer-events-none" />
        )}

        {/* Big Interactive Mic Button */}
        <div className="relative flex items-center gap-4">
          {/* Main Voice Button */}
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
            className={`relative group w-20 h-20 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-xl select-none focus:outline-none focus:ring-4 focus:ring-orange-500/40 ${
              isSpeaking
                ? 'bg-gradient-to-br from-amber-600 to-orange-700 text-white shadow-orange-900/50 scale-105'
                : isRecording
                ? 'bg-gradient-to-br from-orange-600 to-red-600 text-white shadow-orange-950/80 scale-110 ring-4 ring-orange-500/50 animate-pulse'
                : isThinking
                ? 'bg-stone-800 text-orange-400 border border-orange-500/40 cursor-wait'
                : 'bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 text-white hover:scale-105 hover:shadow-orange-900/40'
            }`}
            title={
              isSpeaking
                ? 'Interrumpir voz de Potato'
                : isRecording
                ? 'Detener escucha y enviar'
                : 'Hablar con Potato (Hermes Voice)'
            }
          >
            {isSpeaking ? (
              <Square className="w-8 h-8 fill-current" />
            ) : isRecording ? (
              <Mic className="w-9 h-9 animate-bounce" />
            ) : isThinking ? (
              <div className="w-8 h-8 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
            ) : (
              <Mic className="w-9 h-9 group-hover:scale-110 transition-transform" />
            )}

            <span className="text-[10px] font-mono tracking-wider font-semibold uppercase mt-1">
              {isSpeaking ? 'Detener' : isRecording ? 'Escuchando' : isThinking ? 'Pensando' : 'Hablar'}
            </span>
          </button>
        </div>

        {/* Subtitle / Mode hint */}
        <div className="mt-3 text-center">
          <p className="text-xs font-mono text-stone-400">
            {isSpeaking ? (
              <span className="text-amber-300 font-medium">Potato está hablando por voz... (Click para parar)</span>
            ) : isRecording ? (
              <span className="text-orange-400 font-semibold animate-pulse">Habla ahora... Las barras Cava reaccionan a tu voz</span>
            ) : isThinking ? (
              <span className="text-stone-400">Hermes está formulando la respuesta...</span>
            ) : (
              <span className="text-stone-400">Presiona para hablar con Hermes o activa manos libres</span>
            )}
          </p>
        </div>
      </div>

      {/* Live Interim Transcript Bubble */}
      {interimTranscript && (
        <div className="w-full max-w-xl px-4 py-2.5 rounded-xl bg-stone-900/90 border border-orange-500/30 text-stone-200 text-sm font-mono flex items-center gap-2 shadow-lg animate-in fade-in">
          <Radio className="w-4 h-4 text-orange-400 shrink-0 animate-pulse" />
          <span className="text-orange-400 text-xs font-semibold">Tú:</span>
          <span className="italic text-stone-300">{interimTranscript}</span>
        </div>
      )}

      {/* Mode Selector and Quick Audio Test */}
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {/* Hands-Free Toggle */}
        <button
          type="button"
          onClick={onToggleHandsFree}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-2 transition-all ${
            handsFree
              ? 'bg-orange-500/20 border-orange-500 text-orange-300 shadow-sm shadow-orange-950'
              : 'bg-stone-900/80 border-stone-800 text-stone-400 hover:text-stone-300 hover:border-stone-700'
          }`}
          title="El modo manos libres reanuda la escucha automáticamente después de que Potato responde"
        >
          <Headphones className="w-3.5 h-3.5" />
          <span>Modo Manos Libres:</span>
          <span className="font-mono font-semibold uppercase text-[10px]">
            {handsFree ? 'Activado' : 'Desactivado'}
          </span>
        </button>

        {/* Audio Visualizer Test Mode Toggle */}
        <button
          type="button"
          onClick={onRunAudioTest}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-2 transition-all ${
            isTestMode
              ? 'bg-amber-500/20 border-amber-500 text-amber-300 animate-pulse'
              : 'bg-stone-900/80 border-stone-800 text-stone-400 hover:text-stone-300 hover:border-stone-700'
          }`}
          title="Genera ondas armónicas sintéticas para probar el movimiento del ecualizador Cava"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>{isTestMode ? 'Detener Test Cava' : 'Probar Cava (Test Audio)'}</span>
        </button>
      </div>

      {/* Quick Prompts */}
      <div className="w-full max-w-2xl">
        <div className="text-[11px] font-mono text-stone-500 text-center mb-2">
          O prueba una pregunta rápida para Hermes:
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {quickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSendTextMessage(prompt)}
              disabled={isThinking || isSpeaking}
              className="text-xs px-3 py-1.5 rounded-lg bg-stone-900/60 border border-stone-800/90 text-stone-400 hover:text-orange-300 hover:border-orange-500/40 hover:bg-orange-500/5 transition-all text-left disabled:opacity-50"
            >
              "{prompt}"
            </button>
          ))}
        </div>
      </div>

      {/* Text Input Fallback */}
      <form onSubmit={handleTextSubmit} className="w-full max-w-xl flex items-center gap-2">
        <input
          type="text"
          value={typedText}
          onChange={(e) => setTypedText(e.target.value)}
          placeholder="Escribe un mensaje para Hermes si no deseas hablar..."
          disabled={isThinking}
          className="flex-1 px-4 py-2.5 rounded-xl bg-stone-900/80 border border-stone-800 text-stone-100 text-xs placeholder:text-stone-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!typedText.trim() || isThinking}
          className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-md shadow-orange-950/40 disabled:opacity-50 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Enviar</span>
        </button>
      </form>
    </div>
  );
};
