import React from 'react';
import { MicOff, ExternalLink, Volume2, X, MessageSquare } from 'lucide-react';

interface MicPermissionBannerProps {
  onDismiss: () => void;
  onOpenInNewTab?: () => void;
  onActivateSimulation?: () => void;
  onFocusTextInput?: () => void;
  customTitle?: string;
  customMessage?: string;
}

export const MicPermissionBanner: React.FC<MicPermissionBannerProps> = ({
  onDismiss,
  onOpenInNewTab,
  onActivateSimulation,
  onFocusTextInput,
  customTitle,
  customMessage,
}) => {
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const title = customTitle || (isInIframe ? 'Micrófono no permitido en este visor' : 'Atención con el micrófono / navegador');
  const message =
    customMessage ||
    (isInIframe
      ? 'El navegador o el marco integrado (iframe) bloquea la captura directa de audio del sistema. Puedes abrir la aplicación en una pestaña independiente para conceder el permiso sin restricciones.'
      : 'El permiso del micrófono no se pudo activar. Asegúrate de dar permiso en el icono de candado de la barra de direcciones o de usar Google Chrome / Brave para soporte completo de voz.');

  return (
    <div className="w-full max-w-xl mx-auto p-4 rounded-2xl bg-[#141210] border border-orange-500/30 shadow-2xl shadow-orange-950/20 text-stone-200 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0 text-orange-400 mt-0.5">
          <MicOff className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-orange-200">
              {title}
            </h3>
            <button
              type="button"
              onClick={onDismiss}
              className="text-stone-500 hover:text-stone-300 p-1 rounded-lg hover:bg-white/5 transition-colors"
              title="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="mt-1 text-xs text-stone-400 leading-relaxed font-sans">
            {message}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {isInIframe && (
              <button
                type="button"
                onClick={onOpenInNewTab}
                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-colors shadow-sm shadow-orange-950"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir en pestaña nueva</span>
              </button>
            )}

            {onFocusTextInput && (
              <button
                type="button"
                onClick={onFocusTextInput}
                className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-mono flex items-center gap-1.5 transition-colors border border-white/10"
              >
                <MessageSquare className="w-3.5 h-3.5 text-stone-400" />
                <span>Escribir mensaje</span>
              </button>
            )}

            {onActivateSimulation && (
              <button
                type="button"
                onClick={onActivateSimulation}
                className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#222] text-orange-300 text-xs font-mono flex items-center gap-1.5 transition-colors border border-orange-500/20"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Modo Simulación CAVA</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
