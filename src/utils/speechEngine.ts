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
  private simulatedTtsTimer: any = null;

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
      options.onError?.('Síntesis de voz no disponible');
      return;
    }

    this.stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate || 1.0;
    utterance.pitch = options.pitch || 1.0;
    utterance.lang = 'es-ES';

    const voices = this.synth.getVoices();
    if (options.voiceName) {
      const match = voices.find((v) => v.name === options.voiceName);
      if (match) utterance.voice = match;
    } else {
      // Pick best Spanish voice if available
      const esVoice = voices.find((v) => v.lang.startsWith('es') && !v.name.includes('Google'));
      if (esVoice) utterance.voice = esVoice;
    }

    utterance.onstart = () => {
      // Activate synthetic frequency pump so cava visualizer animates dynamically during browser speech!
      audioEngine.startTestMode();
      options.onStart?.();
    };

    utterance.onend = () => {
      audioEngine.stopTestMode();
      options.onEnd?.();
    };

    utterance.onerror = (e) => {
      audioEngine.stopTestMode();
      options.onError?.(e);
    };

    this.synth.speak(utterance);
  }

  public stopSpeaking(): void {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (e) {
        // ignore
      }
    }
    audioEngine.stopTestMode();
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }
}

export const speechEngine = new SpeechEngine();
