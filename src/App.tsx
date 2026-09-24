import React, { useState, useEffect, useRef } from 'react';
import { TopBar } from './components/TopBar.tsx';
import { CavaVisualizer } from './components/CavaVisualizer.tsx';
import { VoiceController } from './components/VoiceController.tsx';
import { ChatTranscript, ChatMessage } from './components/ChatTranscript.tsx';
import { AudioStatsWidget } from './components/AudioStatsWidget.tsx';
import { HermesSettingsModal, HermesConfig } from './components/HermesSettingsModal.tsx';
import { audioEngine } from './utils/audioEngine.ts';
import { speechEngine } from './utils/speechEngine.ts';
import { callHermesDirectly } from './utils/hermesClient.ts';
import { Radio, Sparkles, Volume2, Mic, Terminal, Info, Zap, Globe, Key, AlertTriangle, Bot, ExternalLink } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'potato_hermes_config_v3';

export default function App() {
  // Load saved config or default directly to Hermes Agent
  const [config, setConfig] = useState<HermesConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            provider: parsed.provider || 'hermes_agent_local',
            endpoint: parsed.endpoint || 'http://127.0.0.1:8642/v1/chat/completions',
            apiKey: parsed.apiKey || '',
            model: parsed.model || 'hermes-agent',
            systemPrompt:
              parsed.systemPrompt ||
              'Eres "Potato", un asistente de voz carismático y dinámico conectado con Hermes Agent (hermes-agent.ai). Responde siempre en español conversacional, claro y conciso (máximo 2 a 3 oraciones por turno para facilitar la escucha fluida por voz). Evita markdown complejo o listas largas.',
            temperature: parsed.temperature ?? 0.7,
            handsFree: Boolean(parsed.handsFree),
            voiceName: parsed.voiceName || '',
            barCount: parsed.barCount || 42,
            sensitivity: parsed.sensitivity || 1.5,
            themeColor: parsed.themeColor || 'orange',
            styleType: parsed.styleType || 'solid',
          };
        }
      } catch (e) {
        // ignore
      }
    }

    return {
      provider: 'hermes_agent_local',
      endpoint: 'http://127.0.0.1:8642/v1/chat/completions',
      apiKey: '',
      model: 'hermes-agent',
      systemPrompt:
        'Eres "Potato", un asistente de voz carismático y dinámico conectado con Hermes Agent (hermes-agent.ai). Responde siempre en español conversacional, claro y conciso (máximo 2 a 3 oraciones por turno para facilitar la escucha fluida por voz). Evita markdown complejo o listas largas.',
      temperature: 0.7,
      handsFree: false,
      voiceName: '',
      barCount: 42,
      sensitivity: 1.5,
      themeColor: 'orange',
      styleType: 'solid',
    };
  });

  // Save config changes to localStorage for true pure frontend persistence
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      // ignore
    }
  }, [config]);

  // Voice Interaction States
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content:
        '¡Hola! Soy Potato. Este frontend está conectado directamente con Hermes Agent (hermes-agent.ai). Presiona el micrófono para hablar y verás las barras Cava en audio mono.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      model: 'Hermes Agent Client',
    },
  ]);

  // Audio & Diagnostics
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [dbLevel, setDbLevel] = useState<number>(-90);
  const [isTestMode, setIsTestMode] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [statusNotification, setStatusNotification] = useState<string>('');
  const [connectionNotice, setConnectionNotice] = useState<string>('');

  // Refs for state machine management during async speech callbacks
  const isHandsFreeRef = useRef(config.handsFree);
  isHandsFreeRef.current = config.handsFree;

  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Initialize Speech Voices
  useEffect(() => {
    const loadVoices = () => {
      const v = speechEngine.getAvailableVoices();
      if (v.length > 0) {
        setAvailableVoices(v);
      }
    };
    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Show temporary status badge
  const showToast = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(''), 4000);
  };

  /**
   * Handle starting voice recognition & microphone capture
   */
  const handleStartRecording = async () => {
    try {
      // Check if user is using OpenRouter without key
      if (config.endpoint.includes('openrouter.ai') && !config.apiKey) {
        setIsSettingsOpen(true);
        showToast('Ingresa tu API Key de OpenRouter para conectar con Hermes');
        return;
      }

      // Stop any existing speech or test mode
      speechEngine.stopSpeaking();
      audioEngine.stopAudioPlayback();
      audioEngine.stopTestMode();
      setIsTestMode(false);
      setIsSpeaking(false);

      // Start capturing mono mic audio into Web Audio API for Cava visualizer
      await audioEngine.startMicrophone();
      setIsRecording(true);
      setInterimTranscript('');

      speechEngine.startListening({
        onStart: () => {
          setIsRecording(true);
        },
        onResult: (transcript: string, isFinal: boolean) => {
          setInterimTranscript(transcript);
          if (isFinal && transcript.trim().length > 0) {
            handleStopRecordingWithText(transcript);
          }
        },
        onError: (err: string) => {
          console.warn('Speech error:', err);
          setIsRecording(false);
          audioEngine.stopMicrophone();
          showToast(`Error de audio: ${err}`);
        },
        onEnd: () => {
          setIsRecording(false);
          audioEngine.stopMicrophone();
        },
      });
    } catch (err: any) {
      console.error('Microphone error:', err);
      setIsRecording(false);
      audioEngine.stopMicrophone();
      showToast('No se pudo acceder al micrófono. Verifica los permisos.');
    }
  };

  /**
   * Stop recording manually and process whatever text was captured
   */
  const handleStopRecording = () => {
    speechEngine.stopListening();
    audioEngine.stopMicrophone();
    setIsRecording(false);

    if (interimTranscript.trim().length > 0) {
      handleStopRecordingWithText(interimTranscript);
    }
  };

  /**
   * Send captured text directly to Hermes Agent API from this frontend
   */
  const handleStopRecordingWithText = async (textToSend: string) => {
    speechEngine.stopListening();
    audioEngine.stopMicrophone();
    setIsRecording(false);
    setInterimTranscript('');

    const trimmed = textToSend.trim();
    if (!trimmed) return;

    // Check if key is needed
    if (config.endpoint.includes('openrouter.ai') && !config.apiKey) {
      setIsSettingsOpen(true);
      showToast('Por favor añade tu clave de Hermes en Configuración');
      return;
    }

    // Add user message to history
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedHistory = [...messagesRef.current, userMsg];
    setMessages(updatedHistory);
    setIsThinking(true);

    const startTime = performance.now();

    try {
      // Call Hermes directly from frontend
      const result = await callHermesDirectly({
        endpoint: config.endpoint,
        apiKey: config.apiKey,
        model: config.model,
        messages: updatedHistory.map((m) => ({ role: m.role, content: m.content })),
        systemPrompt: config.systemPrompt,
        temperature: config.temperature,
      });

      const elapsed = Math.round(performance.now() - startTime);
      setLatencyMs(elapsed);

      const replyText = result.text || 'Entendido.';

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: result.model || config.model,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setIsThinking(false);

      if (result.directBrowserCall) {
        setConnectionNotice('Conexión directa desde tu navegador a Hermes Agent');
      }

      // Speak response aloud & animate Cava visualizer!
      await speakPotatoResponse(replyText, assistantMsg.id);
    } catch (err: any) {
      console.error('Hermes Agent direct error:', err);
      setIsThinking(false);
      showToast(`Error al consultar a Hermes Agent: ${err.message}`);

      const errorMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `No se pudo conectar con Hermes Agent (${err.message}). Si lo ejecutas localmente, verifica que API_SERVER_ENABLED=true esté en tu ~/.hermes/.env o ajusta el endpoint en Configuración.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: 'Hermes Agent Error',
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  /**
   * Speak response via Web Speech Synthesis,
   * routing the audio into the Cava Mono Visualizer
   */
  const speakPotatoResponse = async (text: string, msgId?: string) => {
    setIsSpeaking(true);

    speechEngine.speakText(text, {
      voiceName: config.voiceName,
      onStart: () => {
        setIsSpeaking(true);
      },
      onEnd: () => {
        onFinishSpeaking();
      },
      onError: (err) => {
        console.warn('Speech synthesis error:', err);
        onFinishSpeaking();
      },
    });
  };

  /**
   * After speaking completes, check if hands-free is enabled to take the next turn
   */
  const onFinishSpeaking = () => {
    setIsSpeaking(false);
    audioEngine.stopTestMode();

    if (isHandsFreeRef.current) {
      // Give a tiny natural breath pause, then auto-listen
      setTimeout(() => {
        if (isHandsFreeRef.current && !isSpeakingRef.current) {
          handleStartRecording();
        }
      }, 700);
    }
  };

  /**
   * Interrupt Potato speaking immediately
   */
  const handleInterruptSpeech = () => {
    speechEngine.stopSpeaking();
    audioEngine.stopAudioPlayback();
    audioEngine.stopTestMode();
    setIsSpeaking(false);
    showToast('Reproducción de voz detenida');
  };

  /**
   * Send text message directly (e.g. from quick prompts or text box)
   */
  const handleSendTextMessage = (text: string) => {
    handleStopRecordingWithText(text);
  };

  /**
   * Replay previous message
   */
  const handleReplayAudio = (msg: ChatMessage) => {
    speakPotatoResponse(msg.content, msg.id);
  };

  /**
   * Toggle Audio Visualizer Test Mode
   */
  const handleRunAudioTest = () => {
    if (isTestMode) {
      audioEngine.stopTestMode();
      setIsTestMode(false);
      showToast('Test de audio Cava detenido');
    } else {
      audioEngine.startTestMode();
      setIsTestMode(true);
      showToast('Simulando señal armónica en audio mono para Cava');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100 selection:bg-orange-500 selection:text-white font-sans">
      {/* Top Bar (3-Zone Contract) */}
      <TopBar
        onOpenSettings={() => setIsSettingsOpen(true)}
        provider="Hermes Agent"
        isOnline={true}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* Banner with Hermes Agent status indicator */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-stone-900/90 border border-orange-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-orange-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold text-white">Frontend para Hermes Agent</span>
                <a
                  href="https://hermes-agent.ai/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-mono text-orange-400 hover:text-orange-300 flex items-center gap-0.5 hover:underline"
                >
                  <span>hermes-agent.ai</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-xs text-stone-400 font-mono mt-0.5">
                Endpoint activo: <span className="text-orange-300">{config.endpoint}</span> ({config.model})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="px-3.5 py-1.5 text-xs font-mono font-semibold text-stone-950 bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-300 hover:to-amber-300 rounded-xl transition-all shadow-md"
            >
              Cambiar Endpoint / API Key
            </button>
          </div>
        </div>

        {/* Hero Section & Potato Branding */}
        <section className="flex flex-col md:flex-row items-center justify-between gap-6 pb-2 border-b border-orange-500/10">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-orange-500/30 bg-stone-900 shadow-xl shadow-orange-950/30 shrink-0">
              <img
                src="/src/assets/images/potato_avatar_1790246166447.jpg"
                alt="Potato Mascot Emblem"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
            </div>

            <div>
              <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-mono text-stone-400">
                <span>Frontend de Voz</span>
                <span aria-hidden="true">·</span>
                <span className="text-orange-400 font-medium">Hermes Agent AI</span>
                <span aria-hidden="true">·</span>
                <span className="text-stone-500">Audio Mono Cava</span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-syne tracking-tight text-white mt-1">
                Potato — Hermes Agent Voice Console
              </h1>
              <p className="text-xs sm:text-sm text-stone-400 mt-1 max-w-xl">
                Interfaz de voz para <strong className="text-orange-400 font-semibold font-mono">Hermes Agent</strong>. Las barras estilo <strong className="text-orange-400 font-semibold font-mono">cava</strong> bailan en audio mono reactivas a tu voz y a las respuestas del agente.
              </p>
            </div>
          </div>

          {/* Quick Status Tag */}
          <div className="flex flex-col items-center md:items-end gap-1 font-mono text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-900/90 border border-orange-500/20 text-stone-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-stone-400">Agente:</span>
              <span className="text-orange-300 font-semibold truncate max-w-[140px]">
                {config.model}
              </span>
            </div>
            <span className="text-[11px] text-stone-500">
              {config.provider === 'hermes_agent_local'
                ? 'Hermes Agent Local (:8642)'
                : config.provider === 'hermes_agent_nous_portal'
                ? 'Nous Portal Gateway'
                : 'OpenAI-Compatible API'}
            </span>
          </div>
        </section>

        {/* CAVA VISUALIZER SECTION (Hero Visual Centerpiece) */}
        <section id="cava-section" className="w-full space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-xs font-mono text-orange-400 font-semibold">
              <Terminal className="w-4 h-4 text-orange-500" />
              <span>Visualizador Cava en Audio Mono</span>
            </div>
            <div className="text-[11px] font-mono text-stone-400 hidden sm:block">
              {connectionNotice || 'Reactivo a Micrófono y Respuestas del Agente'}
            </div>
          </div>

          {/* The Cava Equalizer Bars Component */}
          <CavaVisualizer
            barCount={config.barCount}
            sensitivity={config.sensitivity}
            isRecording={isRecording}
            isSpeaking={isSpeaking}
            channelMode="mono"
            themeColor={config.themeColor}
            styleType={config.styleType}
            onBarCountChange={(count) => setConfig((c) => ({ ...c, barCount: count }))}
            onSensitivityChange={(val) => setConfig((c) => ({ ...c, sensitivity: val }))}
          />
        </section>

        {/* VOICE INTERACTION CONTROLLER SECTION */}
        <section id="voice-section" className="py-2">
          <VoiceController
            isRecording={isRecording}
            isSpeaking={isSpeaking}
            isThinking={isThinking}
            handsFree={config.handsFree}
            interimTranscript={interimTranscript}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onInterruptSpeech={handleInterruptSpeech}
            onToggleHandsFree={() => setConfig((c) => ({ ...c, handsFree: !c.handsFree }))}
            onSendTextMessage={handleSendTextMessage}
            onRunAudioTest={handleRunAudioTest}
            isTestMode={isTestMode}
          />
        </section>

        {/* TELEMETRY & DIAGNOSTICS SECTION */}
        <section id="telemetry-section" className="pt-2">
          <AudioStatsWidget
            modelName={config.model}
            provider="Hermes Agent (hermes-agent.ai)"
            latencyMs={latencyMs}
            isMicActive={isRecording}
            isSpeaking={isSpeaking}
            sampleRate={audioEngine.getSampleRate()}
            dbLevel={dbLevel}
          />
        </section>

        {/* CHAT TRANSCRIPT SECTION */}
        <section id="chat-section" className="pt-2">
          <ChatTranscript
            messages={messages}
            onReplayAudio={handleReplayAudio}
            onClearHistory={() => setMessages([])}
            isSpeaking={isSpeaking}
          />
        </section>
      </main>

      {/* Floating Status Notification Toast */}
      {statusNotification && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-stone-900 border border-orange-500/40 text-stone-200 text-xs font-mono shadow-2xl shadow-orange-950/80 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Info className="w-4 h-4 text-orange-400 shrink-0" />
          <span>{statusNotification}</span>
        </div>
      )}

      {/* Settings Modal */}
      <HermesSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSave={(newCfg) => {
          setConfig(newCfg);
          showToast('Configuración de Hermes Agent guardada');
        }}
        availableVoices={availableVoices}
      />

      {/* Clean Footer */}
      <footer className="border-t border-orange-500/10 bg-stone-950 py-6 text-center text-xs font-mono text-stone-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-orange-400 font-semibold">Potato</span>
            <span>·</span>
            <span>Frontend de Voz para Hermes Agent (hermes-agent.ai)</span>
          </div>
          <div className="text-stone-600">
            Compatible con la API oficial de Hermes Agent (puerto 8642) y Nous Portal
          </div>
        </div>
      </footer>
    </div>
  );
}
