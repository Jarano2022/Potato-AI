import React, { useState } from 'react';
import { X, ShieldAlert, Copy, Check, Terminal, ExternalLink, Smartphone, Laptop, Sparkles } from 'lucide-react';

interface RemoteMicHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentOrigin?: string;
}

export const RemoteMicHelpModal: React.FC<RemoteMicHelpModalProps> = ({
  isOpen,
  onClose,
  currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://tu-ip:3000',
}) => {
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [copiedFlagUrl, setCopiedFlagUrl] = useState(false);
  const [copiedTailscale, setCopiedTailscale] = useState(false);

  if (!isOpen) return null;

  const chromeFlagUrl = 'chrome://flags/#unsafely-treat-insecure-origin-as-secure';
  const tailscaleCmd = 'tailscale serve --bg 3000';

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-[#0f0f0f] border border-orange-500/30 p-6 shadow-2xl text-stone-200 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-stone-100 flex items-center gap-2">
                <span>Micrófono en otro dispositivo (Red Local / IP)</span>
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Por qué falla y cómo activarlo en 30 segundos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/5 text-stone-400 hover:text-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Motivo */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed">
          <span className="font-semibold text-amber-100">🔒 Política de seguridad del navegador:</span> Por diseño, los navegadores (Chrome, Safari, Edge, Android, iOS) <strong>bloquean el micrófono</strong> en cualquier dirección <code className="bg-black/40 px-1 py-0.5 rounded text-amber-200">http://</code> que no sea <code className="bg-black/40 px-1 py-0.5 rounded text-amber-200">localhost</code>.
        </div>

        {/* Solución 1: Flag de Chrome */}
        <div className="p-4 rounded-xl bg-[#141414] border border-white/10 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-orange-300">
            <Smartphone className="w-4 h-4" />
            <span>Opción 1: Habilitar excepción en este navegador (30 seg)</span>
          </div>
          <p className="text-xs text-stone-400 leading-relaxed">
            Funciona en Chrome, Chromium, Edge y Brave (tanto en PC como en móviles Android):
          </p>

          <ol className="text-xs text-stone-300 space-y-2 list-decimal list-inside pl-1">
            <li className="leading-relaxed">
              Abre una nueva pestaña y pega esta dirección especial:
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 bg-black/60 px-2.5 py-1.5 rounded-lg border border-white/10 text-orange-300 font-mono text-[11px] truncate select-all">
                  {chromeFlagUrl}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(chromeFlagUrl, setCopiedFlagUrl)}
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-stone-300 flex items-center gap-1 shrink-0 transition-colors"
                >
                  {copiedFlagUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedFlagUrl ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </li>
            <li className="leading-relaxed">
              En el campo de texto de esa página, pega la dirección de tu Potato:
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 bg-black/60 px-2.5 py-1.5 rounded-lg border border-white/10 text-emerald-300 font-mono text-[11px] truncate select-all">
                  {currentOrigin}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(currentOrigin, setCopiedOrigin)}
                  className="px-2.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-xs font-mono text-white flex items-center gap-1 shrink-0 transition-colors shadow-sm"
                >
                  {copiedOrigin ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedOrigin ? 'Copiado' : 'Copiar IP'}</span>
                </button>
              </div>
            </li>
            <li className="leading-relaxed">
              Selecciona <strong className="text-white">Enabled</strong> a la derecha y pulsa <strong className="text-white">Relaunch</strong> (Reiniciar navegador).
            </li>
          </ol>
        </div>

        {/* Solución 2: Tailscale Serve */}
        <div className="p-4 rounded-xl bg-[#141414] border border-white/10 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
            <Laptop className="w-4 h-4" />
            <span>Opción 2: HTTPS automático con Tailscale (Sin tocar flags)</span>
          </div>
          <p className="text-xs text-stone-400 leading-relaxed">
            Si tienes Tailscale en tu máquina host, ejecuta este comando para crear un túnel HTTPS local con certificado SSL válido:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-black/60 px-2.5 py-1.5 rounded-lg border border-white/10 text-emerald-300 font-mono text-[11px] truncate select-all">
              {tailscaleCmd}
            </code>
            <button
              type="button"
              onClick={() => copyToClipboard(tailscaleCmd, setCopiedTailscale)}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-stone-300 flex items-center gap-1 shrink-0 transition-colors"
            >
              {copiedTailscale ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedTailscale ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
          <p className="text-[11px] text-stone-500">
            Podrás acceder desde cualquier dispositivo mediante <span className="font-mono text-stone-400">https://tu-pc.ts.net:3000</span> y el micrófono funcionará nativamente.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-[11px] text-stone-500">
            Mientras tanto, puedes usar la caja de texto inferior.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-mono font-medium transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
