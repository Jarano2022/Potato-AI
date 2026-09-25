import React, { useState, useEffect, useRef } from 'react';
import { TopBar } from './components/TopBar.tsx';
import { CavaVisualizer } from './components/CavaVisualizer.tsx';
import { VoiceController } from './components/VoiceController.tsx';
import { ChatTranscript, ChatMessage } from './components/ChatTranscript.tsx';
import { HermesSettingsModal, HermesConfig } from './components/HermesSettingsModal.tsx';
import { MicPermissionBanner } from './components/MicPermissionBanner.tsx';
import { audioEngine } from './utils/audioEngine.ts';
import { speechEngine } from './utils/speechEngine.ts';
import { callHermesDirectly } from './utils/hermesClient.ts';

const LOCAL_STORAGE_KEY = 'potato_hermes_config_v5';
const DEFAULT_HERMES_ENDPOINT = 'http://192.168.1.199:8642/v1/chat/completions';
const DEFAULT_HERMES_TOKEN = '2c0e16d8cb65e8a8e3733897a326009903ba77cefea321ee1354d224ec94';

export default function App() {
  const [config, setConfig] = useState<HermesConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            provider: parsed.provider || 'hermes_agent_lan',
            endpoint: parsed.endpoint || DEFAULT_HERMES_ENDPOINT,
            apiKey: parsed.apiKey || DEFAULT_HERMES_TOKEN,
            model: parsed.model || 'hermes-agent',
            systemPrompt:
              parsed.systemPrompt ||
              'Eres "Potato", un asistente de voz conciso y natural conectado con Hermes Agent. Responde siempre en español conversacional breve.',
            temperature: parsed.temperature ?? 0.7,
            handsFree: Boolean(parsed.handsFree),
            voiceName: parsed.voiceName || '',
            barCount: parsed.barCount || 48,
            sensitivity: parsed.sensitivity || 1.3,
            themeColor: parsed.themeColor || '#f97316', // Solid vibrant orange
          };
        }
      } catch (e) {
        // ignore
      }
    }

    return {
      provider: 'hermes_agent_lan',
      endpoint: DEFAULT_HERMES_ENDPOINT,
      apiKey: DEFAULT_HERMES_TOKEN,
      model: 'hermes-agent',
      systemPrompt:
        'Eres "Potato", un asistente de voz conciso y natural conectado con Hermes Agent. Responde siempre en español conversacional breve.',
      temperature: 0.7,
      handsFree: false,
      voiceName: '',
      barCount: 48,
      sensitivity: 1.3,
      themeColor: '#f97316',
    };
  });

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTestMode, setIsTestMode] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showMicBanner, setShowMicBanner] = useState(false);
  const [micBannerData, setMicBannerData] = useState<{ title: string; message: string } | null>(null);
  const [agentStatusText, setAgentStatusText] = useState<string>('');

  const isHandsFreeRef = useRef(config.handsFree);
  isHandsFreeRef.current = config.handsFree;

  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    const loadVoices = () => {
      const v = speechEngine.getAvailableVoices();
      if (v.length > 0) setAvailableVoices(v);
    };
    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const handleStartRecording = async () => {
    setShowMicBanner(false);
    setAgentStatusText('');
    try {
      speechEngine.stopSpeaking();
      audioEngine.stopAudioPlayback();
      audioEngine.stopTestMode();
      setIsTestMode(false);
      setIsSpeaking(false);

      // Check if browser supports Web Speech API
      if (!speechEngine.isSpeechSupported()) {
        setShowMicBanner(true);
        setMicBannerData({
          title: 'Navegador sin reconocimiento de voz Web Speech (ej. Firefox)',
          message: 'Tu navegador actual no tiene activada la API nativa de voz. Abre http://localhost:3000 en Google Chrome, Brave o Edge para hablar con el micrófono, o escribe directamente en la caja de texto inferior.',
        });
        setAgentStatusText('Usa Chrome o escribe tu mensaje abajo');
        return;
      }

      // Attempt microphone capture
      let micReady = false;
      try {
        await audioEngine.startMicrophone();
        micReady = true;
      } catch (micErr: any) {
        console.warn('Microphone stream could not be started in current context:', micErr?.message || micErr);
        setShowMicBanner(true);
        setMicBannerData({
          title: micErr?.name === 'NotAllowedError' ? 'Permiso de micrófono bloqueado' : 'Micrófono no detectado',
          message: micErr?.name === 'NotAllowedError'
            ? 'El navegador tiene bloqueado el micrófono. Haz clic en el icono del candado en la barra de direcciones de tu navegador y concede permiso al micrófono.'
            : 'No se pudo acceder a ningún micrófono en tu sistema. Puedes escribir tus mensajes directamente en la caja inferior.',
        });
        setAgentStatusText('Permiso de micrófono necesario');
        setIsRecording(false);
        audioEngine.stopMicrophone();
        return;
      }

      if (!micReady) return;

      setIsRecording(true);
      setInterimTranscript('');
      setAgentStatusText('Escuchando...');

      speechEngine.startListening({
        onStart: () => {
          setIsRecording(true);
          setAgentStatusText('Escuchando tu voz...');
        },
        onResult: (transcript: string, isFinal: boolean) => {
          setInterimTranscript(transcript);
          if (isFinal && transcript.trim().length > 0) {
            handleStopRecordingWithText(transcript);
          }
        },
        onError: (err: string) => {
          console.warn('Speech recognition warning:', err);
          setIsRecording(false);
          audioEngine.stopMicrophone();
          if (err === 'not-allowed') {
            setShowMicBanner(true);
            setMicBannerData({
              title: 'Permiso de micrófono bloqueado',
              message: 'El navegador denegó el acceso al micrófono. Haz clic en el candado junto a la URL y permite el micrófono.',
            });
            setAgentStatusText('Micrófono bloqueado');
          } else if (err === 'no-speech') {
            setAgentStatusText('No se detectó voz. Vuelve a pulsar para hablar.');
          } else if (err === 'network') {
            setShowMicBanner(true);
            setMicBannerData({
              title: 'Error de red en el reconocimiento de voz',
              message: 'El servicio de voz del navegador no pudo contactar con los servidores de transcripción. Puedes escribir tus mensajes por texto abajo.',
            });
            setAgentStatusText('Error de red en voz');
          } else {
            setShowMicBanner(true);
            setMicBannerData({
              title: 'Aviso del motor de voz',
              message: `${err}. Puedes interactuar directamente escribiendo en la caja de texto inferior.`,
            });
            setAgentStatusText('Escribe tu mensaje abajo');
          }
        },
        onEnd: () => {
          setIsRecording(false);
          audioEngine.stopMicrophone();
        },
      });
    } catch (err: any) {
      console.warn('Mic access warning:', err?.message || err);
      setShowMicBanner(true);
      setMicBannerData({
        title: 'Error al iniciar captura de audio',
        message: err?.message || 'No se pudo iniciar el micrófono en tu dispositivo.',
      });
      setIsRecording(false);
      audioEngine.stopMicrophone();
    }
  };

  const handleStopRecording = () => {
    speechEngine.stopListening();
    audioEngine.stopMicrophone();
    setIsRecording(false);

    if (interimTranscript.trim().length > 0) {
      handleStopRecordingWithText(interimTranscript);
    }
  };

  const handleStopRecordingWithText = async (textToSend: string) => {
    speechEngine.stopListening();
    audioEngine.stopMicrophone();
    setIsRecording(false);
    setInterimTranscript('');

    const trimmed = textToSend.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedHistory = [...messagesRef.current, userMsg];
    setMessages(updatedHistory);
    setIsThinking(true);

    try {
      const result = await callHermesDirectly({
        endpoint: config.endpoint,
        apiKey: config.apiKey,
        model: config.model,
        messages: updatedHistory.map((m) => ({ role: m.role, content: m.content })),
        systemPrompt: config.systemPrompt,
        temperature: config.temperature,
      });

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

      await speakPotatoResponse(replyText);
    } catch (err: any) {
      console.warn('Hermes error:', err);
      setIsThinking(false);

      const errorMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `Error al conectar con Hermes: ${err.message}. Verifica el endpoint en Ajustes.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  const speakPotatoResponse = async (text: string) => {
    setIsSpeaking(true);

    speechEngine.speakText(text, {
      voiceName: config.voiceName,
      onStart: () => setIsSpeaking(true),
      onEnd: () => onFinishSpeaking(),
      onError: () => onFinishSpeaking(),
    });
  };

  const onFinishSpeaking = () => {
    setIsSpeaking(false);
    audioEngine.stopTestMode();

    if (isHandsFreeRef.current) {
      setTimeout(() => {
        if (isHandsFreeRef.current && !isSpeakingRef.current) {
          handleStartRecording();
        }
      }, 600);
    }
  };

  const handleInterruptSpeech = () => {
    speechEngine.stopSpeaking();
    audioEngine.stopAudioPlayback();
    audioEngine.stopTestMode();
    setIsSpeaking(false);
  };

  const handleRunAudioTest = () => {
    if (isTestMode) {
      audioEngine.stopTestMode();
      setIsTestMode(false);
    } else {
      audioEngine.startTestMode();
      setIsTestMode(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#070707] text-stone-200 selection:bg-orange-500 selection:text-white font-sans antialiased">
      {/* Top Bar Minimal */}
      <TopBar
        onOpenSettings={() => setIsSettingsOpen(true)}
        provider="Hermes Agent"
        isOnline={true}
      />

      {/* Main Single-column Minimalist Canvas */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 flex flex-col items-center justify-center gap-8">
        {/* Seamless Fluid Single-Color Cava Visualizer */}
        <section className="w-full">
          <CavaVisualizer
            barCount={config.barCount}
            sensitivity={config.sensitivity}
            isRecording={isRecording}
            isSpeaking={isSpeaking}
            color={config.themeColor}
            onBarCountChange={(count) => setConfig((c) => ({ ...c, barCount: count }))}
            onSensitivityChange={(val) => setConfig((c) => ({ ...c, sensitivity: val }))}
          />
        </section>

        {/* Microphone Permission Notice Banner if blocked */}
        {showMicBanner && (
          <section className="w-full">
            <MicPermissionBanner
              onDismiss={() => {
                setShowMicBanner(false);
                setMicBannerData(null);
              }}
              customTitle={micBannerData?.title}
              customMessage={micBannerData?.message}
              onOpenInNewTab={() => window.open(window.location.href, '_blank')}
              onActivateSimulation={() => {
                setShowMicBanner(false);
                handleRunAudioTest();
              }}
              onFocusTextInput={() => {
                setShowMicBanner(false);
                setTimeout(() => {
                  const inputEl = document.getElementById('voice-chat-text-input');
                  inputEl?.focus();
                }, 50);
              }}
            />
          </section>
        )}

        {/* Central Voice Control */}
        <section className="w-full">
          <VoiceController
            isRecording={isRecording}
            isSpeaking={isSpeaking}
            isThinking={isThinking}
            agentStatusText={agentStatusText}
            handsFree={config.handsFree}
            interimTranscript={interimTranscript}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onInterruptSpeech={handleInterruptSpeech}
            onToggleHandsFree={() => setConfig((c) => ({ ...c, handsFree: !c.handsFree }))}
            onSendTextMessage={(text) => handleStopRecordingWithText(text)}
            onRunAudioTest={handleRunAudioTest}
            isTestMode={isTestMode}
          />
        </section>

        {/* Minimal Chat Transcript */}
        {messages.length > 0 && (
          <section className="w-full">
            <ChatTranscript
              messages={messages}
              onReplayAudio={(msg) => speakPotatoResponse(msg.content)}
              onClearHistory={() => setMessages([])}
              isSpeaking={isSpeaking}
            />
          </section>
        )}
      </main>

      {/* Settings Modal */}
      <HermesSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSave={(newCfg) => setConfig(newCfg)}
        availableVoices={availableVoices}
      />

      {/* Minimal Footer */}
      <footer className="py-4 text-center text-[10px] font-mono text-stone-600 border-t border-white/5">
        Hermes Agent Voice · Mono Fluid Cava
      </footer>
    </div>
  );
}
