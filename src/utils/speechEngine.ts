/**
 * Speech Recognition and Synthesis engine for Potato Voice Chat
 */

import { audioEngine } from './audioEngine.ts';

export interface SpeechRecognitionHandlers {
  onStart?: () => void;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export class SpeechEngine {
  private recognition: any = null;
  private isListening: boolean = false;
  private synth: SpeechSynthesis | null = null;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private cachedVoices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        this.recognition = new SpeechRec();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'es-ES'; // Default Spanish as requested
      }
      if ('speechSynthesis' in window) {
        this.synth = window.speechSynthesis;
        this.cachedVoices = this.synth.getVoices() || [];
        this.synth.onvoiceschanged = () => {
          this.cachedVoices = this.synth?.getVoices() || [];
        };
      }
    }
  }

  public isSpeechSupported(): boolean {
    return Boolean(this.recognition);
  }

  public isSynthesisSupported(): boolean {
    return Boolean(this.synth);
  }

  public setLanguage(lang: string): void {
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  public startListening(handlers: SpeechRecognitionHandlers): void {
    if (!this.recognition) {
      handlers.onError?.('Reconocimiento de voz no soportado en este navegador.');
      return;
    }

    if (this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
    }

    this.recognition.onstart = () => {
      this.isListening = true;
      handlers.onStart?.();
    };

    this.recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      const text = final || interim;
      handlers.onResult?.(text, Boolean(final));
    };

    this.recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      this.isListening = false;
      if (event.error !== 'no-speech') {
        handlers.onError?.(event.error);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      handlers.onEnd?.();
    };

    try {
      this.recognition.start();
    } catch (e: any) {
      handlers.onError?.(e.message || 'Error al iniciar reconocimiento.');
    }
  }

  public stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
      this.isListening = false;
    }
  }

  /**
   * Speak using browser SpeechSynthesis with simulated audio frequency pump
   * for Cava visualizer animation
   */
  public speakText(
    text: string,
    options: {
      voiceName?: string;
      rate?: number;
      pitch?: number;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    } = {}
  ): void {
    if (!this.synth) {
      options.onError?.('Síntesis de voz no disponible en este navegador');
      return;
    }

    this.stopSpeaking();

    // In Chromium on Linux, SpeechSynthesis can get stuck in a paused state
    try {
      if (this.synth.paused) {
        this.synth.resume();
      }
    } catch (e) {
      // ignore
    }

    const utterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance = utterance; // Prevent garbage collection bug in Chromium

    utterance.rate = options.rate || 1.0;
    utterance.pitch = options.pitch || 1.0;
    utterance.lang = 'es-ES';

    const voices = this.synth.getVoices().length > 0 ? this.synth.getVoices() : this.cachedVoices;
    if (options.voiceName) {
      const match = voices.find((v) => v.name === options.voiceName);
      if (match) utterance.voice = match;
    }
    
    if (!utterance.voice && voices.length > 0) {
      // 1. Pick any Spanish voice (including Google, Microsoft, eSpeak, etc.)
      const esVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith('es') ||
          v.name.toLowerCase().includes('spanish') ||
          v.name.toLowerCase().includes('español')
      );
      if (esVoice) {
        utterance.voice = esVoice;
      } else {
        // Fallback to default voice or first available so it never stays mute
        utterance.voice = voices.find((v) => v.default) || voices[0];
      }
    }

    utterance.onstart = () => {
      // Activate synthetic frequency pump so cava visualizer animates dynamically during browser speech!
      audioEngine.startTestMode();
      options.onStart?.();
    };

    utterance.onend = () => {
      audioEngine.stopTestMode();
      this.currentUtterance = null;
      options.onEnd?.();
    };

    utterance.onerror = (e) => {
      audioEngine.stopTestMode();
      this.currentUtterance = null;
      options.onError?.(e);
    };

    try {
      this.synth.speak(utterance);
    } catch (err) {
      audioEngine.stopTestMode();
      this.currentUtterance = null;
      options.onError?.(err);
    }
  }

  public stopSpeaking(): void {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (e) {
        // ignore
      }
    }
    this.currentUtterance = null;
    audioEngine.stopTestMode();
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    const v = this.synth.getVoices();
    return v.length > 0 ? v : this.cachedVoices;
  }
}

export const speechEngine = new SpeechEngine();
