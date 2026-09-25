/**
 * Hermes Agent WebSocket JSON-RPC 2.0 Client
 *
 * Implements bidirectional real-time communication with `hermes serve`
 * Transport: WebSocket (JSON-RPC 2.0)
 * Events: agent.state, tool.call, tool.result, token.delta / token.stream, turn.complete
 */

export type HermesWsStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface HermesToolActivity {
  tool: string;
  input?: any;
  output?: any;
  status: 'running' | 'completed' | 'error';
  timestamp: string;
}

export interface HermesPromptCallbacks {
  onToken?: (token: string, fullText: string) => void;
  onState?: (state: string, details?: any) => void;
  onToolCall?: (tool: string, input: any) => void;
  onToolResult?: (tool: string, output: any) => void;
  onTurnComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export interface HermesRpcResponse {
  jsonrpc: '2.0';
  id?: number | string | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  method?: string;
  params?: {
    type?: string;
    session_id?: string;
    payload?: any;
    [key: string]: any;
  };
}

class HermesWsManager {
  private ws: WebSocket | null = null;
  private currentUrl: string = 'ws://localhost:56700';
  private sessionId: string = `hermes-session-${Date.now().toString(36)}`;
  private status: HermesWsStatus = 'disconnected';
  private statusListeners: Set<(status: HermesWsStatus) => void> = new Set();
  
  private nextRequestId: number = 1;
  private pendingRequests: Map<number | string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();
  
  // Active streaming turn state
  private currentCallbacks: HermesPromptCallbacks | null = null;
  private currentStreamText: string = '';
  private isTurnActive: boolean = false;
  private reconnectTimer: any = null;
  private manualDisconnect: boolean = false;

  constructor() {
    // Session ID initialised
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public setSessionId(newId: string) {
    if (newId && newId.trim()) {
      this.sessionId = newId.trim();
    }
  }

  public resetSession(): string {
    this.sessionId = `hermes-session-${Date.now().toString(36)}`;
    return this.sessionId;
  }

  public getStatus(): HermesWsStatus {
    return this.status;
  }

  public getUrl(): string {
    return this.currentUrl;
  }

  public onStatusChange(callback: (status: HermesWsStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  private setStatus(newStatus: HermesWsStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((cb) => {
        try {
          cb(newStatus);
        } catch (e) {
          console.error('Error in status listener:', e);
        }
      });
    }
  }

  /**
   * Connect to hermes serve WebSocket server.
   * If running in HTTPS and connecting to an insecure ws:// URL,
   * offers automatic fallback to the local server relay /api/ws-relay.
   */
  public async connect(targetUrl?: string): Promise<boolean> {
    if (targetUrl) {
      this.currentUrl = targetUrl.trim();
    }

    this.manualDisconnect = false;
    clearTimeout(this.reconnectTimer);

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.setStatus('connected');
        return true;
      }
    }

    this.setStatus('connecting');

    return new Promise((resolve) => {
      let resolved = false;

      let effectiveUrl = this.currentUrl;
      // If browser is on https and target is insecure ws://localhost, attempt direct first;
      // if browser rejects due to mixed content, we can use the server proxy.
      try {
        this.ws = new WebSocket(effectiveUrl);
      } catch (err: any) {
        console.warn('Direct WebSocket creation failed:', err);
        // Try relay if in https
        if (typeof window !== 'undefined' && window.location.protocol === 'https:' && effectiveUrl.startsWith('ws://')) {
          try {
            const relayWsUrl = `${window.location.origin.replace(/^http/, 'ws')}/api/ws-relay?target=${encodeURIComponent(effectiveUrl)}`;
            this.ws = new WebSocket(relayWsUrl);
          } catch (relayErr) {
            this.setStatus('error');
            resolve(false);
            return;
          }
        } else {
          this.setStatus('error');
          resolve(false);
          return;
        }
      }

      const connectionTimeout = setTimeout(() => {
        if (!resolved && this.ws?.readyState !== WebSocket.OPEN) {
          console.warn('Hermes WebSocket connection timeout to', effectiveUrl);
          this.setStatus('disconnected');
          if (this.ws) {
            try { this.ws.close(); } catch (e) { /* ignore */ }
          }
          resolved = true;
          resolve(false);
        }
      }, 5000);

      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        this.setStatus('connected');
        if (!resolved) {
          resolved = true;
          resolve(true);
        }
      };

      this.ws.onmessage = (event) => {
        this.handleIncomingMessage(event.data);
      };

      this.ws.onerror = (evt) => {
        console.warn('Hermes WebSocket error:', evt);
        this.setStatus('error');
        if (!resolved) {
          clearTimeout(connectionTimeout);
          resolved = true;
          resolve(false);
        }
      };

      this.ws.onclose = () => {
        this.setStatus('disconnected');
        this.cleanupActiveTurn();
        if (!this.manualDisconnect) {
          // Schedule auto-reconnect attempt after 4s
          this.reconnectTimer = setTimeout(() => {
            if (!this.manualDisconnect && this.status === 'disconnected') {
              this.connect();
            }
          }, 4000);
        }
        if (!resolved) {
          clearTimeout(connectionTimeout);
          resolved = true;
          resolve(false);
        }
      };
    });
  }

  public disconnect() {
    this.manualDisconnect = true;
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // ignore
      }
      this.ws = null;
    }
    this.setStatus('disconnected');
    this.cleanupActiveTurn();
  }

  /**
   * Send JSON-RPC 2.0 prompt to Hermes Agent and listen to streaming events
   */
  public async sendPrompt(
    prompt: string,
    callbacks: HermesPromptCallbacks,
    customSessionId?: string
  ): Promise<string> {
    const activeSession = customSessionId || this.sessionId;

    // Ensure connection is active
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      const connected = await this.connect();
      if (!connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        throw new Error(
          `No se pudo conectar al servidor Hermes (${this.currentUrl}). Verifica que 'hermes serve' esté ejecutándose.`
        );
      }
    }

    const requestId = this.nextRequestId++;
    this.currentCallbacks = callbacks;
    this.currentStreamText = '';
    this.isTurnActive = true;

    // Build JSON-RPC payload as defined by hermes serve
    const rpcPayload = {
      jsonrpc: '2.0',
      id: requestId,
      method: 'agent.prompt',
      params: {
        session_id: activeSession,
        prompt: prompt.trim(),
      },
    };

    return new Promise<string>((resolve, reject) => {
      // Store request resolver for initial JSON-RPC response
      this.pendingRequests.set(requestId, {
        resolve: (result) => {
          // Initial ack received (e.g. { status: "processing" })
          if (callbacks.onState) {
            callbacks.onState('Iniciando procesamiento...');
          }
        },
        reject: (err) => {
          this.cleanupActiveTurn();
          reject(err);
        },
      });

      // Wrap turn completion callback to resolve outer promise
      const originalTurnComplete = callbacks.onTurnComplete;
      this.currentCallbacks!.onTurnComplete = (fullText: string) => {
        if (originalTurnComplete) {
          originalTurnComplete(fullText);
        }
        this.cleanupActiveTurn();
        resolve(fullText);
      };

      const originalError = callbacks.onError;
      this.currentCallbacks!.onError = (err: Error) => {
        if (originalError) {
          originalError(err);
        }
        this.cleanupActiveTurn();
        reject(err);
      };

      try {
        this.ws!.send(JSON.stringify(rpcPayload));
      } catch (sendErr: any) {
        this.cleanupActiveTurn();
        reject(new Error(`Fallo al enviar mensaje por WebSocket: ${sendErr?.message || sendErr}`));
      }
    });
  }

  /**
   * Abort current turn
   */
  public abortCurrentTurn(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isTurnActive) {
      try {
        this.ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: this.nextRequestId++,
            method: 'agent.abort',
            params: {
              session_id: this.sessionId,
            },
          })
        );
      } catch (e) {
        console.warn('Failed to send abort:', e);
      }
    }
    this.cleanupActiveTurn();
  }

  private handleIncomingMessage(rawMessage: string | ArrayBuffer) {
    if (typeof rawMessage !== 'string') {
      try {
        rawMessage = new TextDecoder().decode(rawMessage);
      } catch {
        return;
      }
    }

    let parsed: HermesRpcResponse;
    try {
      parsed = JSON.parse(rawMessage);
    } catch (e) {
      console.warn('Hermes WS non-JSON message received:', rawMessage);
      return;
    }

    // 1. Check if it's a response to a pending request ID
    if (parsed.id !== undefined && parsed.id !== null && this.pendingRequests.has(parsed.id)) {
      const handler = this.pendingRequests.get(parsed.id);
      this.pendingRequests.delete(parsed.id);
      if (handler) {
        if (parsed.error) {
          handler.reject(new Error(`Hermes RPC Error (${parsed.error.code}): ${parsed.error.message}`));
        } else {
          handler.resolve(parsed.result);
        }
      }
      return;
    }

    // 2. Check if it's a real-time event notification ("method": "event")
    if (parsed.method === 'event' && parsed.params) {
      const { type, payload } = parsed.params;
      this.handleRpcEvent(type || '', payload);
      return;
    }

    // 3. Fallback for events that might have different JSON-RPC wrappers
    if (parsed.method && parsed.method !== 'event') {
      this.handleRpcEvent(parsed.method, parsed.params);
    }
  }

  private handleRpcEvent(eventType: string, payload: any) {
    if (!this.currentCallbacks) return;

    switch (eventType) {
      // Token streaming
      case 'token.delta':
      case 'token.stream':
      case 'token': {
        const textChunk =
          typeof payload === 'string'
            ? payload
            : payload?.text ?? payload?.delta ?? payload?.token ?? '';
        if (textChunk) {
          this.currentStreamText += textChunk;
          if (this.currentCallbacks.onToken) {
            this.currentCallbacks.onToken(textChunk, this.currentStreamText);
          }
        }
        break;
      }

      // Agent State updates
      case 'agent.state':
      case 'state': {
        const stateMessage =
          typeof payload === 'string'
            ? payload
            : payload?.state ?? payload?.message ?? payload?.status ?? 'Pensando...';
        if (this.currentCallbacks.onState) {
          this.currentCallbacks.onState(stateMessage, payload);
        }
        break;
      }

      // Tool Call initiated
      case 'tool.call': {
        const toolName = payload?.tool ?? payload?.name ?? 'herramienta';
        const toolInput = payload?.input ?? payload?.arguments ?? payload?.params ?? null;
        if (this.currentCallbacks.onToolCall) {
          this.currentCallbacks.onToolCall(toolName, toolInput);
        }
        break;
      }

      // Tool Result received
      case 'tool.result': {
        const toolName = payload?.tool ?? payload?.name ?? 'herramienta';
        const toolOutput = payload?.output ?? payload?.result ?? payload;
        if (this.currentCallbacks.onToolResult) {
          this.currentCallbacks.onToolResult(toolName, toolOutput);
        }
        break;
      }

      // Turn completed
      case 'turn.complete':
      case 'turn.done': {
        const finalFullText = this.currentStreamText.trim() || payload?.text || 'Hecho.';
        if (this.currentCallbacks.onTurnComplete) {
          this.currentCallbacks.onTurnComplete(finalFullText);
        }
        break;
      }

      // Error event
      case 'error':
      case 'agent.error': {
        const errMsg = payload?.message || payload?.error || 'Error en Hermes Agent';
        if (this.currentCallbacks.onError) {
          this.currentCallbacks.onError(new Error(errMsg));
        }
        break;
      }

      default:
        // Other informational events
        break;
    }
  }

  private cleanupActiveTurn() {
    this.currentCallbacks = null;
    this.isTurnActive = false;
  }
}

export const hermesWsClient = new HermesWsManager();

/**
 * Helper to test WebSocket connection to hermes serve
 */
export async function testHermesWsConnection(
  url: string = 'ws://localhost:56700'
): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    let ws: WebSocket;
    let resolved = false;

    try {
      ws = new WebSocket(url.trim());
    } catch (e: any) {
      resolve({
        ok: false,
        message: `Error al abrir WebSocket: ${e?.message || 'URL inválida o bloqueada por el navegador.'}`,
      });
      return;
    }

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { ws.close(); } catch {}
        resolve({
          ok: false,
          message: `Tiempo de espera agotado al conectar a ${url}. Asegúrate de que 'hermes serve' esté corriendo.`,
        });
      }
    }, 4000);

    ws.onopen = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        try { ws.close(); } catch {}
        resolve({
          ok: true,
          message: `¡Conexión WebSocket exitosa con Hermes Serve en ${url}!`,
        });
      }
    };

    ws.onerror = (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({
          ok: false,
          message: `No se pudo conectar a ${url}. ¿Está iniciado 'hermes serve' en tu máquina?`,
        });
      }
    };
  });
}
