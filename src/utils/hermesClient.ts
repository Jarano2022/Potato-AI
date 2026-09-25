/**
 * Direct Frontend Hermes Client
 * Calls the Hermes OpenAI-compatible API directly from the browser (pure frontend)
 * with CORS proxy fallback only if browser blocks cross-origin requests.
 */

export interface HermesDirectRequest {
  endpoint: string;
  apiKey: string;
  model: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface HermesDirectResponse {
  text: string;
  model: string;
  provider: string;
  directBrowserCall: boolean;
}

export async function callHermesDirectly(params: HermesDirectRequest): Promise<HermesDirectResponse> {
  const {
    endpoint = 'http://192.168.1.199:8642/v1/chat/completions',
    apiKey = '',
    model = 'hermes-agent',
    messages,
    temperature = 0.7,
    maxTokens = 350,
    systemPrompt = 'Eres "Potato", un asistente de voz carismático, directo e ingenioso impulsado por Hermes. Responde siempre en español claro, conciso y natural (máximo 2 a 3 oraciones para escucha fluida por voz). No uses listas largas ni markdown pesado.',
  } = params;

  const isHermesAgent = model === 'hermes-agent' || endpoint.includes(':8642');

  // For Hermes Agent daemon, send pure user/assistant message array (no prepended system prompt) matching curl
  const formattedMessages = isHermesAgent
    ? messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))
    : [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  }

  // OpenRouter recommended headers for pure frontend clients
  if (endpoint.includes('openrouter.ai')) {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'Potato Hermes Voice Chat';
  }

  // Exact payload matching: {"model": "hermes-agent", "messages": [{"role": "user", "content": "..."}]}
  const payload: any = {
    model: model || 'hermes-agent',
    messages: formattedMessages.length > 0 ? formattedMessages : [{ role: 'user', content: 'Hola' }],
  };

  if (!isHermesAgent) {
    payload.temperature = temperature;
    payload.max_tokens = maxTokens;
  }

  try {
    // 1. First attempt: Direct fetch straight from the user's browser to the Hermes endpoint
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? data.hermes?.error ?? '';
      return {
        text,
        model: data.model || model,
        provider: 'hermes_direct_browser',
        directBrowserCall: true,
      };
    }

    const errData = await res.text();
    let parsedErr = '';
    try {
      const json = JSON.parse(errData);
      parsedErr = json.choices?.[0]?.message?.content || json.hermes?.error || json.error?.message || json.message || errData;
    } catch {
      parsedErr = errData.slice(0, 250);
    }

    throw new Error(`Hermes API (${res.status}): ${parsedErr}`);
  } catch (browserError: any) {
    // If it failed due to CORS or local network restrictions (e.g. 192.168.x / localhost from https iframe), route through transparent proxy
    const isCorsOrNetwork =
      browserError.name === 'TypeError' ||
      browserError.message?.includes('Failed to fetch') ||
      browserError.message?.includes('NetworkError');

    if (isCorsOrNetwork) {
      console.warn('Direct browser fetch blocked by CORS or network, routing via server relay...', browserError);
      
      const relayRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          apiKey,
          model,
          messages,
          systemPrompt,
          temperature,
          provider: 'hermes_custom',
        }),
      });

      if (!relayRes.ok) {
        const errText = await relayRes.text();
        let parsed = errText;
        try {
          const json = JSON.parse(errText);
          parsed = json.choices?.[0]?.message?.content || json.hermes?.error || json.error || errText;
        } catch {}
        throw new Error(parsed || 'Error al conectar con Hermes');
      }

      const data = await relayRes.json();
      return {
        text: data.text,
        model: data.model || model,
        provider: 'hermes_relay',
        directBrowserCall: false,
      };
    }

    throw browserError;
  }
}

export function isPrivateNetworkAddress(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local')) return true;
    if (host.startsWith('192.168.') || host.startsWith('10.')) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return true;
    if (/^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(host)) return true; // Tailscale CGNAT 100.64.0.0/10
    return false;
  } catch {
    return false;
  }
}

export async function testHermesDirectConnection(
  endpoint: string,
  apiKey: string,
  model: string
): Promise<{ ok: boolean; message: string; direct: boolean; isPrivateIssue?: boolean }> {
  const isHermesAgent = model === 'hermes-agent' || endpoint.includes(':8642');
  const isPrivate = isPrivateNetworkAddress(endpoint);
  const isCloudHost = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }
    if (endpoint.includes('openrouter.ai')) {
      headers['HTTP-Referer'] = window.location.origin;
      headers['X-Title'] = 'Potato Hermes Voice Chat';
    }

    const payload: any = {
      model: model || 'hermes-agent',
      messages: [{ role: 'user', content: 'Di "Hermes conectado" en dos palabras.' }],
    };
    if (!isHermesAgent) {
      payload.max_tokens = 15;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || data.hermes?.error || 'Conexión exitosa';
      return { ok: true, message: `Conexión directa desde tu navegador: "${reply.trim()}"`, direct: true };
    }

    const err = await res.text();
    let parsedErr = err;
    try {
      const json = JSON.parse(err);
      parsedErr = json.choices?.[0]?.message?.content || json.hermes?.error || json.error?.message || err;
    } catch {}
    return { ok: false, message: `Error HTTP ${res.status}: ${parsedErr.slice(0, 180)}`, direct: true };
  } catch (err: any) {
    // If browser CORS or mixed-content prevented direct check, test via proxy
    try {
      const resProxy = await fetch('/api/hermes/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, apiKey, model }),
      });
      const data = await resProxy.json();
      if (resProxy.ok && data.ok) {
        return {
          ok: true,
          message: `Conexión verificada (relay del servidor): "${data.reply}"`,
          direct: false,
        };
      }
      return {
        ok: false,
        message: data.error || (isPrivate && isCloudHost
          ? 'No accesible desde la nube (IP privada local/Tailscale). Ejecuta la app en local con "npm run dev" o usa un túnel HTTPS.'
          : err.message),
        direct: false,
        isPrivateIssue: Boolean(data.isPrivateNetworkIssue || (isPrivate && isCloudHost)),
      };
    } catch (e: any) {
      if (isPrivate && isCloudHost) {
        return {
          ok: false,
          message: 'No se puede conectar a una IP privada local/Tailscale desde la nube de AI Studio. Ejecuta "npm run dev" en tu PC o crea un túnel HTTPS.',
          direct: false,
          isPrivateIssue: true,
        };
      }
      return { ok: false, message: err.message || 'Error de conexión', direct: false };
    }
  }
}
