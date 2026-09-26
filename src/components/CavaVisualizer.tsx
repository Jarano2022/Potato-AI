import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../utils/audioEngine.ts';
import { Maximize2, Minimize2 } from 'lucide-react';

interface CavaVisualizerProps {
  barCount?: number;
  sensitivity?: number;
  isRecording?: boolean;
  isSpeaking?: boolean;
  isThinking?: boolean;
  color?: string; // Single solid color, defaults to clean vibrant amber/orange '#f97316'
  onBarCountChange?: (count: number) => void;
  onSensitivityChange?: (val: number) => void;
}

export const CavaVisualizer: React.FC<CavaVisualizerProps> = ({
  barCount = 48,
  sensitivity = 1.3,
  isRecording = false,
  isSpeaking = false,
  isThinking = false,
  color = '#f97316',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync fullscreen change with document event (handles ESC key as well)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Smooth floating values (using continuous interpolation / lerp for ultra-fluid movement without cuts)
  const barHeightsRef = useRef<Float32Array>(new Float32Array(96));
  const velocitiesRef = useRef<Float32Array>(new Float32Array(96));

  useEffect(() => {
    barHeightsRef.current = new Float32Array(barCount);
    velocitiesRef.current = new Float32Array(barCount);
  }, [barCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();

    const render = (now: number) => {
      animationFrameRef.current = requestAnimationFrame(render);

      const dt = Math.min(32, now - lastTime) / 1000; // delta time capped at 32ms
      lastTime = now;

      // Handle HiDPI scaling smoothly
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.floor(rect.width * dpr);
      const targetH = Math.floor(rect.height * dpr);

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      const width = rect.width;
      const height = rect.height;

      // Pure minimalist background (clean deep black)
      ctx.fillStyle = '#080808';
      ctx.fillRect(0, 0, width, height);

      // Audio data ingestion
      const analyser = audioEngine.getAnalyser();
      const isTest = audioEngine.getIsTestMode();
      let rawFrequencies: Uint8Array | null = null;
      let hasRealAudio = false;

      if (analyser && !isTest) {
        const bufferLen = analyser.frequencyBinCount;
        const data = new Uint8Array(bufferLen);
        analyser.getByteFrequencyData(data);
        rawFrequencies = data;

        // Check if there is actual acoustic volume in the analyser
        let sum = 0;
        const checkLen = Math.min(bufferLen, 64);
        for (let b = 0; b < checkLen; b++) {
          sum += data[b];
        }
        if (sum > 60) {
          hasRealAudio = true;
        }
      } else if (isTest) {
        rawFrequencies = audioEngine.getSyntheticFrequencies();
        hasRealAudio = true;
      }

      const numBars = barCount;
      const barHeights = barHeightsRef.current;
      const totalBins = rawFrequencies ? rawFrequencies.length : 64;

      // Speech rhythm clock for organic voice animation
      const speechTime = now * 0.001;

      // Calculate fluid targets with smooth continuous curves
      for (let i = 0; i < numBars; i++) {
        let targetNorm = 0;

        if (isSpeaking) {
          // Dynamic CAVA response when Hermes is speaking
          if (hasRealAudio && rawFrequencies) {
            // Live frequency data from Web Audio API (e.g. Neural TTS or routed audio)
            const startBin = Math.floor(Math.pow(i / numBars, 1.35) * (totalBins * 0.75));
            const endBin = Math.max(startBin + 1, Math.floor(Math.pow((i + 1) / numBars, 1.35) * (totalBins * 0.75)));

            let binSum = 0;
            let count = 0;
            for (let b = startBin; b < endBin && b < totalBins; b++) {
              binSum += rawFrequencies[b] || 0;
              count++;
            }
            const avg = count > 0 ? binSum / count : 0;
            // Boost dynamic range for voice presence
            targetNorm = (avg / 255) * sensitivity * 1.35;
          } else {
            // Organic speech simulation for native browser SpeechSynthesis (which bypasses Web Audio)
            // Syllabic modulation (3.8Hz speech syllable rhythm)
            const syllable = Math.sin(speechTime * 22) * 0.35 + 0.65;
            // Phrasing cadence & natural emphasis breathing (1.2Hz)
            const phrase = Math.sin(speechTime * 7.2) * Math.cos(speechTime * 3.4);
            const emphasis = Math.max(0.15, phrase * 0.45 + 0.55);

            // Human speech formants:
            // 1. Low fundamental frequency resonance (~120-250Hz, bars 12-25%)
            const bassDist = Math.abs(i - numBars * 0.2) / (numBars * 0.22);
            const bassFormant = Math.max(0, 1 - bassDist * bassDist) * (Math.sin(speechTime * 18 + i * 0.25) * 0.35 + 0.65);

            // 2. Mid vowel formants (~500-1800Hz, bars 32-55%)
            const midDist = Math.abs(i - numBars * 0.44) / (numBars * 0.28);
            const midFormant = Math.max(0, 1 - midDist * midDist) * (Math.sin(speechTime * 28 + i * 0.42) * 0.4 + 0.6);

            // 3. High speech presence / sibilance (~3-6kHz, bars 65-85%)
            const hiDist = Math.abs(i - numBars * 0.75) / (numBars * 0.24);
            const hiFormant = Math.max(0, 1 - hiDist * hiDist) * (Math.sin(speechTime * 44 + i * 0.65) * 0.3 + 0.7);

            // Combined voice curve
            const voiceCurve = bassFormant * 0.95 + midFormant * 1.15 + hiFormant * 0.55;
            const dynamicVoice = voiceCurve * syllable * emphasis;

            // Micro-harmonics for living acoustic visualizer texture
            const texture = Math.sin(speechTime * 52 + i * 0.85) * 0.05;

            targetNorm = (dynamicVoice * 0.8 + texture) * sensitivity;
            // Keep a gentle lively floor while Hermes is speaking so bars don't go flat
            targetNorm = Math.max(0.06, targetNorm);
          }
        } else if (isRecording && rawFrequencies) {
          // User is speaking into microphone
          const startBin = Math.floor(Math.pow(i / numBars, 1.4) * (totalBins * 0.75));
          const endBin = Math.max(startBin + 1, Math.floor(Math.pow((i + 1) / numBars, 1.4) * (totalBins * 0.75)));

          let binSum = 0;
          let count = 0;
          for (let b = startBin; b < endBin && b < totalBins; b++) {
            binSum += rawFrequencies[b] || 0;
            count++;
          }
          const avg = count > 0 ? binSum / count : 0;
          targetNorm = (avg / 255) * sensitivity;
        } else if (isTest && rawFrequencies) {
          // Test mode
          const bin = Math.min(totalBins - 1, Math.floor((i / numBars) * totalBins));
          targetNorm = ((rawFrequencies[bin] || 0) / 255) * sensitivity;
        } else if (isThinking) {
          // Energetic harmonic pulse while Hermes is thinking or streaming tokens
          const t = now * 0.0035;
          const wave = Math.sin(t + i * 0.18) * 0.5 + 0.5;
          targetNorm = 0.04 + wave * 0.11;
        } else {
          // Gentle resting harmonic pulse: ultra-smooth sine wave when idle
          const t = now * 0.0018;
          const wave = Math.sin(t + i * 0.12) * 0.5 + 0.5;
          targetNorm = 0.025 + wave * 0.04;
        }

        targetNorm = Math.min(1.0, Math.max(0, targetNorm));

        // Fluid interpolation: organic spring lerp with fast attack and smooth decay
        const current = barHeights[i] || 0;
        if (targetNorm > current) {
          // Snappy response to voice transients
          const riseSpeed = isSpeaking ? 22 : 18;
          barHeights[i] = current + (targetNorm - current) * Math.min(1, dt * riseSpeed);
        } else {
          // Smooth fluid decay without jarring steps
          const fallSpeed = isSpeaking ? 11 : 8.5;
          barHeights[i] = current + (targetNorm - current) * Math.min(1, dt * fallSpeed);
        }
      }

      // Continuous Fluid Curve Rendering (without breaks or segments)
      // We draw uniform minimalist vertical bars of ONE single color, with perfect rounded caps
      const padding = isFullscreen ? 32 : 16;
      const availableW = width - padding * 2;
      const barSpacing = availableW / numBars;
      const barW = Math.max(2.5, barSpacing * 0.68); // elegant slender proportion
      const baselinePadding = isFullscreen ? 36 : 18;
      const baselineY = height - baselinePadding;
      const maxH = height - (isFullscreen ? 80 : 36);

      ctx.fillStyle = color; // Solid single color as requested

      for (let i = 0; i < numBars; i++) {
        const x = padding + i * barSpacing + (barSpacing - barW) / 2;
        const h = Math.max(4, (barHeights[i] || 0) * maxH);
        const y = baselineY - h;

        // Smooth pill-shaped single-color bar with rounded top and bottom for fluid softness
        const radius = barW / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, [radius, radius, radius, radius]);
        ctx.fill();
      }

      // Minimal baseline rule
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, baselineY + 2);
      ctx.lineTo(width - padding, baselineY + 2);
      ctx.stroke();

      ctx.restore();
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [barCount, sensitivity, isRecording, isSpeaking, color, isFullscreen]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {
          // Fallback if browser blocks standard requestFullscreen
          setIsFullscreen((prev) => !prev);
        });
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {
          setIsFullscreen(false);
        });
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-2xl overflow-hidden bg-[#080808] border border-white/5 transition-all ${
        isFullscreen
          ? 'fixed inset-0 z-50 h-screen w-screen rounded-none p-6 sm:p-10 flex flex-col justify-between'
          : 'flex flex-col'
      }`}
    >
      {/* Top minimal status bar */}
      <div
        className={`flex items-center justify-between select-none font-mono text-stone-500 shrink-0 ${
          isFullscreen ? 'px-8 pt-6 pb-2 text-sm' : 'px-5 pt-3.5 pb-1 text-[11px]'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`rounded-full transition-all ${isFullscreen ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5'}`}
            style={{ backgroundColor: isRecording || isSpeaking ? color : '#525252' }}
          />
          <span className="tracking-wider uppercase text-stone-400 font-medium">
            {isRecording ? 'Escuchando Voz' : isSpeaking ? 'Hermes Hablando' : 'Cava Mono'}
          </span>
          <span className="text-stone-700">·</span>
          <span className="text-stone-500 font-mono">1.0 Audio Channel</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-stone-600 font-mono">{barCount} barras</span>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1.5"
            title={isFullscreen ? 'Salir de pantalla completa (ESC)' : 'Pantalla completa ampliada'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4" />
                <span className="text-xs font-mono hidden sm:inline">Salir</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="text-[11px] font-mono hidden sm:inline">Ampliar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Canvas container: substantially higher in fullscreen & standard */}
      <div
        className={`relative w-full transition-all ${
          isFullscreen
            ? 'flex-1 min-h-[75vh] w-full mt-4 flex items-center justify-center'
            : 'h-56 sm:h-64 md:h-72'
        }`}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Fullscreen bottom info hint */}
      {isFullscreen && (
        <div className="flex items-center justify-between text-xs font-mono text-stone-600 px-8 py-2 border-t border-white/5 shrink-0">
          <span>Presiona ESC o el botón para volver</span>
          <span style={{ color }}>{isRecording ? '● Grabando' : isSpeaking ? '▶ Reproduciendo' : '○ Standby'}</span>
        </div>
      )}
    </div>
  );
};
