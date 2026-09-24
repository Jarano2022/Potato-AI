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
    endpoint = 'https://openrouter.ai/api/v1/chat/completions',
    apiKey = '',
    model = 'nousresearch/hermes-3-llama-3.1-8b',
    messages,
    temperature = 0.7,
    maxTokens = 350,
    systemPrompt = 'Eres "Potato", un asistente de voz carismático, directo e ingenioso impulsado por Hermes. Responde siempre en español claro, conciso y natural (máximo 2 a 3 oraciones para escucha fluida por voz). No uses listas largas ni markdown pesado.',
  } = params;

  const formattedMessages = [
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

  const payload = {
    model: model || 'nousresearch/hermes-3-llama-3.1-8b',
    messages: formattedMessages,
    temperature,
    max_tokens: maxTokens,
  };

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
      const text = data.choices?.[0]?.message?.content || '';
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
      parsedErr = json.error?.message || json.message || errData;
    } catch {
      parsedErr = errData.slice(0, 250);
    }

    throw new Error(`Hermes API (${res.status}): ${parsedErr}`);
  } catch (browserError: any) {
    // If it failed due to CORS or local network restrictions, route through transparent proxy
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
        throw new Error(errText || 'Error al conectar con Hermes');
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

export async function testHermesDirectConnection(
  endpoint: string,
  apiKey: string,
  model: string
): Promise<{ ok: boolean; message: string; direct: boolean }> {
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model || 'nousresearch/hermes-3-llama-3.1-8b',
        messages: [{ role: 'user', content: 'Say "Hermes connected" in 2 words.' }],
        max_tokens: 15,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || 'Conexión exitosa';
      return { ok: true, message: `Conexión directa desde tu navegador: "${reply.trim()}"`, direct: true };
    }

    const err = await res.text();
    return { ok: false, message: `Error HTTP ${res.status}: ${err.slice(0, 180)}`, direct: true };
  } catch (err: any) {
    // If browser CORS prevented direct check, test via proxy
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
          message: `Conexión verificada (con proxy CORS para el navegador): "${data.reply}"`,
          direct: false,
        };
      }
      return { ok: false, message: data.error || err.message, direct: false };
    } catch (e: any) {
      return { ok: false, message: err.message || 'Error de conexión', direct: false };
    }
  }
}
