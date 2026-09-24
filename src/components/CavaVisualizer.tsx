import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../utils/audioEngine.ts';
import { Volume2, Sliders, Maximize2, Minimize2, Sparkles, Activity } from 'lucide-react';

interface CavaVisualizerProps {
  barCount?: number;
  sensitivity?: number;
  isRecording?: boolean;
  isSpeaking?: boolean;
  channelMode?: 'mono' | 'stereo';
  themeColor?: string; // 'orange' | 'amber' | 'ember' | 'sunset'
  styleType?: 'solid' | 'segmented' | 'peaks';
  onBarCountChange?: (count: number) => void;
  onSensitivityChange?: (val: number) => void;
  statusText?: string;
}

export const CavaVisualizer: React.FC<CavaVisualizerProps> = ({
  barCount = 42,
  sensitivity = 1.4,
  isRecording = false,
  isSpeaking = false,
  channelMode = 'mono',
  themeColor = 'orange',
  styleType = 'solid',
  statusText,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Peak history and gravity falloff for authentic Cava physics
  const barHeightsRef = useRef<Float32Array>(new Float32Array(128));
  const peakHeightsRef = useRef<Float32Array>(new Float32Array(128));
  const peakHoldCountersRef = useRef<Int32Array>(new Int32Array(128));

  // Audio stats
  const [currentDb, setCurrentDb] = useState<number>(-90);
  const [peakDb, setPeakDb] = useState<number>(-90);

  useEffect(() => {
    // Reset buffer sizes if barCount changes
    barHeightsRef.current = new Float32Array(barCount);
    peakHeightsRef.current = new Float32Array(barCount);
    peakHoldCountersRef.current = new Int32Array(barCount);
  }, [barCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let localPeak = -90;
    let statTimer = 0;

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;

      // Handle high DPI crispness
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      const displayW = rect.width;
      const displayH = rect.height;

      // Clean background with subtle terminal scanlines & dark slate tint
      ctx.fillStyle = '#0a0908'; // Deep warm charcoal/black
      ctx.fillRect(0, 0, displayW, displayH);

      // Draw faint terminal grid lines
      ctx.strokeStyle = 'rgba(255, 107, 0, 0.05)';
      ctx.lineWidth = 1;
      const gridSteps = 6;
      for (let g = 1; g < gridSteps; g++) {
        const y = (displayH / gridSteps) * g;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(displayW, y);
        ctx.stroke();
      }

      // Fetch audio data
      const analyser = audioEngine.getAnalyser();
      const isTest = audioEngine.getIsTestMode();
      let rawFrequencies: Uint8Array;

      if (analyser && !isTest) {
        const bufferLen = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLen);
        analyser.getByteFrequencyData(dataArray);
        rawFrequencies = dataArray;
      } else if (isTest) {
        rawFrequencies = audioEngine.getSyntheticFrequencies();
      } else {
        // Idle gentle breathing line
        rawFrequencies = new Uint8Array(64);
      }

      // Map raw FFT bins to discrete Cava bars using logarithmic frequency bands
      const barHeights = barHeightsRef.current;
      const peakHeights = peakHeightsRef.current;
      const peakHold = peakHoldCountersRef.current;

      const numBars = Math.min(barCount, barHeights.length);
      const totalBins = rawFrequencies.length;
      let sumVolume = 0;

      for (let i = 0; i < numBars; i++) {
        // Logarithmic distribution to give bass & voice speech fundamentals rich resolution
        const startBin = Math.floor(Math.pow(i / numBars, 1.6) * (totalBins * 0.7));
        const endBin = Math.max(startBin + 1, Math.floor(Math.pow((i + 1) / numBars, 1.6) * (totalBins * 0.7)));

        let binSum = 0;
        let binCount = 0;
        for (let b = startBin; b < endBin && b < totalBins; b++) {
          binSum += rawFrequencies[b] || 0;
          binCount++;
        }
        const avg = binCount > 0 ? binSum / binCount : 0;
        sumVolume += avg;

        // Apply sensitivity and normalize to 0..1
        let targetNorm = (avg / 255) * sensitivity;

        // If neither mic nor speech active and not test mode, keep idle resting pulse
        if (!isRecording && !isSpeaking && !isTest) {
          const time = Date.now() * 0.002;
          const idleWave = (Math.sin(time + i * 0.2) * 0.5 + 0.5) * 0.05 + 0.02;
          targetNorm = idleWave;
        }

        targetNorm = Math.min(1.0, Math.max(0, targetNorm));

        // Cava dynamic physics: instantaneous rise, smooth gravity fall
        const current = barHeights[i];
        if (targetNorm > current) {
          barHeights[i] = current + (targetNorm - current) * 0.7; // Fast attack
        } else {
          barHeights[i] = Math.max(0, current - 0.045); // Smooth gravity falloff
        }

        // Peaks calculation
        if (barHeights[i] > peakHeights[i]) {
          peakHeights[i] = barHeights[i];
          peakHold[i] = 12; // Hold for 12 frames
        } else {
          if (peakHold[i] > 0) {
            peakHold[i]--;
          } else {
            peakHeights[i] = Math.max(0, peakHeights[i] - 0.025);
          }
        }
      }

      // Calculate instantaneous dB
      const avgVol = sumVolume / numBars;
      const db = avgVol > 0 ? Math.round(20 * Math.log10(avgVol / 255)) : -90;
      if (db > localPeak) localPeak = db;

      statTimer++;
      if (statTimer % 15 === 0) {
        setCurrentDb(db);
        setPeakDb(localPeak);
        localPeak = -90;
      }

      // Render Cava Bars
      const gap = 3;
      const totalGaps = (numBars - 1) * gap;
      const barWidth = Math.max(3, (displayW - totalGaps - 24) / numBars);
      const startX = 12;
      const maxHeight = displayH - 36; // leave room for cava bottom telemetry

      for (let i = 0; i < numBars; i++) {
        const x = startX + i * (barWidth + gap);
        const barNorm = barHeights[i];
        const barH = Math.max(3, barNorm * maxHeight);
        const y = displayH - 24 - barH;

        // Color gradients: Anaranjados (Orange / Amber / Tangerine)
        let gradient = ctx.createLinearGradient(0, displayH - 24, 0, y);
        if (themeColor === 'orange') {
          // Classic vibrant orange cava
          gradient.addColorStop(0, '#7c2d12'); // deep rust orange base
          gradient.addColorStop(0.35, '#ea580c'); // vivid burnt orange
          gradient.addColorStop(0.7, '#f97316'); // luminous fiery orange
          gradient.addColorStop(1, '#fed7aa'); // soft bright amber peak
        } else if (themeColor === 'amber') {
          gradient.addColorStop(0, '#78350f');
          gradient.addColorStop(0.4, '#d97706');
          gradient.addColorStop(0.8, '#f59e0b');
          gradient.addColorStop(1, '#fef3c7');
        } else {
          // Ember sunset
          gradient.addColorStop(0, '#831843');
          gradient.addColorStop(0.3, '#c2410c');
          gradient.addColorStop(0.7, '#ff6a00');
          gradient.addColorStop(1, '#fde047');
        }

        if (styleType === 'segmented') {
          // Retro segmented blocks like terminal font blocks
          const segmentH = 6;
          const segmentGap = 2;
          const totalSegments = Math.floor(barH / (segmentH + segmentGap));

          for (let s = 0; s < totalSegments; s++) {
            const segY = displayH - 24 - (s + 1) * (segmentH + segmentGap);
            ctx.fillStyle = gradient;
            ctx.fillRect(x, segY, barWidth, segmentH);
          }
        } else {
          // Solid vertical columns with subtle top corner radius
          ctx.fillStyle = gradient;
          ctx.beginPath();
          const radius = Math.min(2, barWidth / 2);
          ctx.roundRect(x, y, barWidth, barH, [radius, radius, 0, 0]);
          ctx.fill();

          // Subtle glow on high energy bars
          if (barNorm > 0.65) {
            ctx.shadowColor = 'rgba(249, 115, 22, 0.4)';
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }

        // Draw Cava Peak Caps
        const peakNorm = peakHeights[i];
        if (peakNorm > 0.05) {
          const peakY = displayH - 24 - peakNorm * maxHeight - 3;
          ctx.fillStyle = '#ffedd5'; // bright peak pip
          ctx.fillRect(x, peakY, barWidth, 2);
        }
      }

      // Bottom Cava baseline & Frequency ticks
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(10, displayH - 22);
      ctx.lineTo(displayW - 10, displayH - 22);
      ctx.stroke();

      // Cava terminal status bar in canvas
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`0 MONO_CH · ${numBars} BARS · ${audioEngine.getSampleRate() / 1000}kHz`, 12, displayH - 8);

      const modeLabel = isSpeaking
        ? 'HERMES VOICE (OUTPUT)'
        : isRecording
        ? 'MIC CAPTURE (INPUT)'
        : isTest
        ? 'TEST HARMONIC WAVE'
        : 'STANDBY';
      ctx.fillStyle = isSpeaking || isRecording ? '#fb923c' : 'rgba(255, 255, 255, 0.3)';
      ctx.textAlign = 'right';
      ctx.fillText(`cava :: ${modeLabel}`, displayW - 12, displayH - 8);
      ctx.textAlign = 'left';

      ctx.restore();
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [barCount, sensitivity, isRecording, isSpeaking, channelMode, themeColor, styleType]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-2xl overflow-hidden border border-orange-500/20 bg-stone-950 shadow-2xl shadow-orange-950/20 transition-all ${
        isFullscreen ? 'p-4 flex flex-col justify-center' : ''
      }`}
    >
      {/* Cava Terminal Konsole Header (faithful to the user's uploaded screenshot) */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-stone-900/90 border-b border-orange-500/15 text-xs font-mono select-none">
        <div className="flex items-center gap-2 text-stone-300">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 inline-block"></span>
          <span className="text-orange-400 font-semibold ml-1">Visualizer : cava — Konsole (mono)</span>
        </div>

        <div className="flex items-center gap-4 text-stone-400">
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-stone-500">Audio:</span>
            <span className="text-orange-300 font-semibold tracking-wide">MONO</span>
            <span className="text-stone-500">·</span>
            <span className="text-stone-400">dB:</span>
            <span className="text-orange-400 font-mono tabular-nums">{currentDb > -80 ? `${currentDb} dB` : '-∞ dB'}</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-1 hover:text-orange-400 hover:bg-stone-800 rounded transition-colors"
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="relative w-full h-52 sm:h-64 md:h-72 bg-stone-950">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
        />

        {/* Live Speaking Indicator Overlay */}
        {(isRecording || isSpeaking) && (
          <div className="absolute top-3 left-4 pointer-events-none flex items-center gap-2 px-2.5 py-1 rounded-md bg-stone-900/80 border border-orange-500/30 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            <span className="text-xs font-mono font-medium text-orange-200 uppercase">
              {isSpeaking ? 'Potato hablando...' : 'Escuchando tu voz...'}
            </span>
          </div>
        )}

        {statusText && (
          <div className="absolute bottom-10 left-4 right-4 pointer-events-none text-center">
            <span className="text-xs font-mono px-3 py-1 rounded bg-stone-900/85 border border-stone-800 text-stone-400">
              {statusText}
            </span>
          </div>
        )}
      </div>

      {/* Cava Bottom Terminal Info Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-stone-900/60 border-t border-orange-500/10 text-xs font-mono text-stone-400">
        <div className="flex items-center gap-2">
          <span className="text-orange-500">●</span>
          <span>127.0.0.1:potato-cava</span>
          <span className="text-stone-600">|</span>
          <span>mono_eq: 50Hz–12kHz</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-stone-500">Modo:</span>
            <span className="text-orange-300 font-medium">Mono Cava Bars</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-stone-500">Barras:</span>
            <span className="text-orange-400 font-semibold">{barCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
