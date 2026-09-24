import React, { useState, useEffect, useRef } from 'react';
import { TopBar } from './components/TopBar.tsx';
import { CavaVisualizer } from './components/CavaVisualizer.tsx';
import { VoiceController } from './components/VoiceController.tsx';
import { ChatTranscript, ChatMessage } from './components/ChatTranscript.tsx';
import { HermesSettingsModal, HermesConfig } from './components/HermesSettingsModal.tsx';
import { audioEngine } from './utils/audioEngine.ts';
import { speechEngine } from './utils/speechEngine.ts';
import { callHermesDirectly } from './utils/hermesClient.ts';

const LOCAL_STORAGE_KEY = 'potato_hermes_config_v4';

export default function App() {
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
              'Eres "Potato", un asistente de voz conciso y natural conectado con Hermes Agent (hermes-agent.ai). Responde siempre en español conversacional de forma breve (1 a 2 oraciones por turno para hablar fluidamente).',
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
      provider: 'hermes_agent_local',
      endpoint: 'http://127.0.0.1:8642/v1/chat/completions',
      apiKey: '',
      model: 'hermes-agent',
      systemPrompt:
        'Eres "Potato", un asistente de voz conciso y natural conectado con Hermes Agent (hermes-agent.ai). Responde siempre en español conversacional de forma breve (1 a 2 oraciones por turno para hablar fluidamente).',
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
    try {
      speechEngine.stopSpeaking();
      audioEngine.stopAudioPlayback();
      audioEngine.stopTestMode();
      setIsTestMode(false);
      setIsSpeaking(false);

      await audioEngine.startMicrophone();
      setIsRecording(true);
      setInterimTranscript('');

      speechEngine.startListening({
        onStart: () => setIsRecording(true),
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
        },
        onEnd: () => {
          setIsRecording(false);
          audioEngine.stopMicrophone();
        },
      });
    } catch (err: any) {
      console.error('Mic error:', err);
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
      console.error('Hermes error:', err);
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

        {/* Central Voice Control */}
        <section className="w-full">
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
