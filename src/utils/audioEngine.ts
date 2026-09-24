/**
 * Audio Engine for Potato Voice Chat
 * Handles Web Audio API contexts, microphone mono stream,
 * audio playback with real-time frequency analysis for the Cava visualizer.
 */

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micStream: MediaStream | null = null;
  private monoMerger: ChannelMergerNode | null = null;
  private activeAudioSource: AudioBufferSourceNode | HTMLAudioElement | null = null;
  private activeAudioElementSourceNode: MediaElementAudioSourceNode | null = null;
  private isTestMode: boolean = false;
  private testInterval: any = null;
  private syntheticFrequencies: Uint8Array = new Uint8Array(64);

  constructor() {
    // Lazy initialize to comply with browser autoplay policies
  }

  public async getAudioContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /**
   * Initializes the Mono Analyser Node
   */
  private async setupAnalyser(): Promise<AnalyserNode> {
    const ctx = await this.getAudioContext();
    if (!this.analyser) {
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 512; // 256 frequency bins
      this.analyser.smoothingTimeConstant = 0.82; // Cava-like inertia
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;
    }
    return this.analyser;
  }

  /**
   * Start capturing microphone in MONO audio
   */
  public async startMicrophone(): Promise<MediaStream> {
    this.stopTestMode();
    const ctx = await this.getAudioContext();
    const analyser = await this.setupAnalyser();

    if (this.micStream) {
      this.stopMicrophone();
    }

    // Request mono audio stream
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1, // Mono audio channel
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.micStream = stream;
    this.micSource = ctx.createMediaStreamSource(stream);

    // Ensure strict mono routing via ChannelMergerNode
    this.monoMerger = ctx.createChannelMerger(1);
    this.micSource.connect(this.monoMerger);
    this.monoMerger.connect(analyser);

    // Note: Do not connect mic to ctx.destination to avoid acoustic feedback!
    return stream;
  }

  /**
   * Stop capturing microphone
   */
  public stopMicrophone(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch (e) {
        // ignore
      }
      this.micSource = null;
    }
  }

  /**
   * Play base64 PCM / WAV audio through Web Audio API
   * and route into the mono analyser for Cava visualizer
   */
  public async playBase64Audio(base64Data: string, sampleRate = 24000): Promise<void> {
    const ctx = await this.getAudioContext();
    const analyser = await this.setupAnalyser();

    // Decode base64 to binary
    const binary = atob(base64Data);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    let audioBuffer: AudioBuffer;

    try {
      // Try native arraybuffer decoding (e.g., WAV/MP3)
      const bufferCopy = bytes.buffer.slice(0);
      audioBuffer = await ctx.decodeAudioData(bufferCopy);
    } catch {
      // If raw PCM 16-bit 24kHz mono
      const pcm16 = new Int16Array(bytes.buffer);
      audioBuffer = ctx.createBuffer(1, pcm16.length, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcm16.length; i++) {
        channelData[i] = pcm16[i] / 32768.0;
      }
    }

    return new Promise((resolve) => {
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      // Connect source to analyser and speaker destination
      source.connect(analyser);
      analyser.connect(ctx.destination);

      source.onended = () => {
        try {
          source.disconnect();
        } catch (e) {
          // ignore
        }
        resolve();
      };

      this.activeAudioSource = source;
      source.start(0);
    });
  }

  /**
   * Connect an HTMLAudioElement or speech audio node to the Cava analyser
   */
  public async connectAudioElement(audioEl: HTMLAudioElement): Promise<void> {
    const ctx = await this.getAudioContext();
    const analyser = await this.setupAnalyser();

    if (!this.activeAudioElementSourceNode) {
      this.activeAudioElementSourceNode = ctx.createMediaElementSource(audioEl);
      this.activeAudioElementSourceNode.connect(analyser);
      analyser.connect(ctx.destination);
    }
  }

  /**
   * Stop any playing audio
   */
  public stopAudioPlayback(): void {
    if (this.activeAudioSource && 'stop' in this.activeAudioSource) {
      try {
        (this.activeAudioSource as AudioBufferSourceNode).stop();
      } catch (e) {
        // ignore
      }
      this.activeAudioSource = null;
    }
  }

  /**
   * Simulate mono frequency data for demonstration / audio test mode
   */
  public startTestMode(): void {
    this.isTestMode = true;
    let tick = 0;

    if (this.testInterval) clearInterval(this.testInterval);

    this.testInterval = setInterval(() => {
      tick += 0.15;
      const data = new Uint8Array(64);
      for (let i = 0; i < 64; i++) {
        // Organic simulated speech harmonics with low bass resonance and mid-range formants
        const base = Math.sin(tick * 1.8 + i * 0.18) * 0.5 + 0.5;
        const speechHarmonic = Math.sin(tick * 3.5 + i * 0.35) * 0.3 + 0.3;
        const voiceRollOff = Math.max(0, 1 - i / 55); // natural voice frequency curve
        const val = Math.floor((base * 0.6 + speechHarmonic * 0.4) * voiceRollOff * 255);
        data[i] = Math.min(255, Math.max(0, val));
      }
      this.syntheticFrequencies = data;
    }, 30);
  }

  public stopTestMode(): void {
    this.isTestMode = false;
    if (this.testInterval) {
      clearInterval(this.testInterval);
      this.testInterval = null;
    }
  }

  public getIsTestMode(): boolean {
    return this.isTestMode;
  }

  public getSyntheticFrequencies(): Uint8Array {
    return this.syntheticFrequencies;
  }

  public getSampleRate(): number {
    return this.ctx?.sampleRate || 44100;
  }
}

// Export singleton instance
export const audioEngine = new AudioEngine();
