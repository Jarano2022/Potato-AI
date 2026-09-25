import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use((req: Request, res: Response, next) => {
  res.setHeader('Permissions-Policy', 'microphone=(self "*"), autoplay=(self "*")');
  next();
});

app.use(express.json({ limit: '15mb' }));

// Initialize GoogleGenAI client (used for fallback or built-in voice intelligence / TTS)
const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Route: Health & Server Config
app.get('/api/status', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    appName: 'Potato',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hermesSupported: true,
  });
});

// Helper to detect private IP / local addresses
function isPrivateNetworkAddress(urlStr: string): boolean {
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

// Route: Get Hermes server environment info (whether key is configured in .env, without exposing it)
app.get('/api/hermes/status', (_req: Request, res: Response) => {
  const hasEnvKey = Boolean(process.env.HERMES_API_KEY || process.env.HERMES_TOKEN);
  const defaultEndpoint = process.env.HERMES_ENDPOINT || 'http://100.94.150.43:8642/v1/chat/completions';
  res.json({
    hasEnvKey,
    defaultEndpoint,
  });
});

// Route: Test Hermes connection (e.g. Hermes Agent daemon, OpenRouter, Ollama, custom URL)
app.post('/api/hermes/test', async (req: Request, res: Response) => {
  const { endpoint, apiKey, model } = req.body;
  let targetUrl = (endpoint || process.env.HERMES_ENDPOINT || 'http://100.94.150.43:8642/v1/chat/completions').trim();
  if (targetUrl.startsWith('://')) targetUrl = 'http' + targetUrl;
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'http://' + targetUrl;
  }

  const isHermesAgent = model === 'hermes-agent' || targetUrl.includes(':8642');
  const isPrivate = isPrivateNetworkAddress(targetUrl);
  
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const effectiveApiKey = (apiKey || process.env.HERMES_API_KEY || process.env.HERMES_TOKEN || '').trim();
    if (effectiveApiKey) {
      headers['Authorization'] = `Bearer ${effectiveApiKey}`;
    }

    const payload: any = {
      model: model || 'hermes-agent',
      messages: [{ role: 'user', content: 'Hola Hermes' }],
    };
    if (!isHermesAgent) {
      payload.max_tokens = 60;
      payload.temperature = 0.7;
    }

    const controller = new AbortController();
    // Hermes Agent reasoning can take 10-25 seconds; allow generous timeout
    const timeout = setTimeout(() => controller.abort(), 45000);

    const apiRes = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      let parsedErr = errText;
      try {
        const json = JSON.parse(errText);
        parsedErr = json.choices?.[0]?.message?.content || json.choices?.[0]?.message?.reasoning_content || json.hermes?.error || json.error?.message || errText;
      } catch {}
      return res.status(apiRes.status).json({
        ok: false,
        error: `Error HTTP ${apiRes.status}: ${parsedErr.slice(0, 250)}`,
      });
    }

    const data: any = await apiRes.json();
    const choiceMsg = data.choices?.[0]?.message;
    const reply = choiceMsg?.content || choiceMsg?.reasoning_content || data.hermes?.error || 'Conexión exitosa';
    return res.json({ ok: true, reply, hermes: data.hermes });
  } catch (error: any) {
    const isAbort = error.name === 'AbortError' || error.message?.includes('aborted');
    let friendlyError = error.message || 'Error conectando con Hermes';
    if (isAbort && isPrivate) {
      friendlyError = `Tiempo agotado con ${targetUrl} (45s). La app está corriendo en la nube (AI Studio) y los servidores de Google no tienen acceso a redes privadas o Tailscale (${targetUrl}). Ejecuta la app localmente con 'npm run dev' en tu PC o crea un túnel HTTPS (Cloudflare Tunnel o Tailscale Funnel).`;
    } else if (isAbort) {
      friendlyError = `Tiempo de espera agotado (timeout 45s) al conectar con ${targetUrl}.`;
    }

    return res.status(500).json({
      ok: false,
      error: friendlyError,
      isPrivateNetworkIssue: isPrivate,
    });
  }
});

// Route: Chat Completion (Hermes or Potato Gemini fallback)
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const {
      messages = [],
      provider = 'hermes_agent_lan', // 'hermes_agent_lan' | 'hermes_agent_local' | 'hermes_openrouter' | 'hermes_ollama' | 'hermes_custom' | 'potato_gemini'
      model = 'hermes-agent',
      endpoint = 'http://192.168.1.199:8642/v1/chat/completions',
      apiKey = '',
      systemPrompt = '',
      temperature = 0.7,
    } = req.body;

    const baseSystem = systemPrompt || 
      'Eres "Potato", un asistente de voz carismático, directo, cálido e ingenioso conectado a Hermes. Tus respuestas se van a reproducir por voz, así que responde en español claro, natural y conciso (máximo 2 a 3 oraciones por turno, a menos que el usuario pida más detalle). No uses listas largas, markdown ni asteriscos innecesarios.';

    // Check if user is routing through Hermes
    if (provider.startsWith('hermes_')) {
      let targetUrl = (endpoint || 'http://100.94.150.43:8642/v1/chat/completions').trim();
      if (targetUrl.startsWith('://')) targetUrl = 'http' + targetUrl;
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'http://' + targetUrl;
      }

      const isHermesAgent = model === 'hermes-agent' || targetUrl.includes(':8642');
      const isPrivate = isPrivateNetworkAddress(targetUrl);
      
      // For Hermes Agent daemon, only pass conversation history (no prepended system instruction) to match exact curl specs
      const formattedMessages = isHermesAgent
        ? messages.map((m: any) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          }))
        : [
            { role: 'system', content: baseSystem },
            ...messages.map((m: any) => ({
              role: m.role === 'assistant' ? 'assistant' : 'user',
              content: m.content,
            })),
          ];

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const effectiveApiKey = (apiKey || process.env.HERMES_API_KEY || process.env.HERMES_TOKEN || '').trim();
      if (effectiveApiKey) {
        headers['Authorization'] = `Bearer ${effectiveApiKey}`;
      }

      // Exact curl payload structure
      const payload: any = {
        model: model || 'hermes-agent',
        messages: formattedMessages.length > 0 ? formattedMessages : [{ role: 'user', content: 'Hola' }],
      };

      if (!isHermesAgent) {
        payload.temperature = temperature;
        payload.max_tokens = 350;
      }

      // If calling OpenRouter without user key, and we have server key or fallback
      if (targetUrl.includes('openrouter.ai') && !apiKey) {
        // If no user API key provided for Hermes OpenRouter, check if we can fallback to Gemini
        const ai = getGenAI();
        if (ai) {
          // Fallback to Gemini 3.8 Flash formatted with Hermes Persona
          const chatContents = formattedMessages.map((msg: any) => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          }));

          const geminiRes = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: chatContents.map((c: any) => `${c.role}: ${c.parts[0].text}`).join('\n\n'),
            config: {
              systemInstruction: `${baseSystem} (Simulando la personalidad audaz y directa de Hermes 3)`,
              temperature,
            }
          });

          return res.json({
            text: geminiRes.text || 'Entendido.',
            usedProvider: 'potato_gemini_fallback',
            model: 'gemini-3.8-flash (Hermes Persona)',
          });
        }
      }

      let hermesRes: any;
      try {
        const controller = new AbortController();
        // Generous 60-second timeout for Hermes reasoning
        const timeout = setTimeout(() => controller.abort(), 60000);

        hermesRes = await fetch(targetUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeout);
      } catch (fetchErr: any) {
        const isAbort = fetchErr.name === 'AbortError' || fetchErr.message?.includes('aborted');
        const reason = isAbort && isPrivate
          ? `Tiempo agotado con ${targetUrl} (60s). La nube de AI Studio no tiene ruta a tu IP privada o Tailscale.`
          : (fetchErr.message || 'Error de conexión con Hermes');

        const ai = getGenAI();
        if (ai) {
          const fallbackRes = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: messages[messages.length - 1]?.content || 'Hola',
            config: {
              systemInstruction: `${baseSystem} [Nota del sistema: ${reason}. Responde al usuario de forma natural indicando brevemente lo que ocurre si preguntan por la conexión.]`,
              temperature,
            }
          });
          return res.json({
            text: fallbackRes.text || 'Hola, no se pudo conectar con tu servidor Hermes privado desde la nube.',
            usedProvider: 'potato_gemini_fallback',
            model: 'gemini-3.8-flash',
            warning: reason,
          });
        }

        return res.status(504).json({
          error: reason,
        });
      }

      if (!hermesRes.ok) {
        const errorText = await hermesRes.text();
        let parsedMessage = errorText;
        try {
          const json = JSON.parse(errorText);
          parsedMessage = json.choices?.[0]?.message?.content || json.choices?.[0]?.message?.reasoning_content || json.hermes?.error || json.error?.message || errorText;
        } catch {}

        // If Hermes returned an auth or rate limit error and we have Gemini available, provide helpful fallback
        const ai = getGenAI();
        if (ai) {
          const fallbackRes = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: messages[messages.length - 1]?.content || 'Hola',
            config: {
              systemInstruction: `${baseSystem} [Nota del sistema: El endpoint de Hermes devolvió ${hermesRes.status}. Responde como Potato con gracia.]`,
              temperature,
            }
          });
          return res.json({
            text: fallbackRes.text || 'Hola, te escucho.',
            usedProvider: 'potato_gemini_fallback',
            model: 'gemini-3.8-flash',
            warning: `Hermes respondió con error ${hermesRes.status}: ${parsedMessage.slice(0, 150)}`,
          });
        }

        return res.status(hermesRes.status).json({
          error: `Hermes API Error (${hermesRes.status}): ${parsedMessage.slice(0, 300)}`,
        });
      }

      const data = await hermesRes.json();
      const choiceMsg = data.choices?.[0]?.message;
      const outputText = choiceMsg?.content || choiceMsg?.reasoning_content || data.hermes?.error || '';
      return res.json({
        text: outputText,
        usedProvider: provider,
        model: data.model || model,
        hermes: data.hermes,
      });
    }

    // Default Provider: Potato Engine powered by Gemini 3.8 Flash
    const ai = getGenAI();
    if (!ai) {
      return res.status(500).json({
        error: 'No se encontró API Key configurada para el motor de Potato.',
      });
    }

    const conversationPrompt = messages.map((m: any) => `${m.role === 'assistant' ? 'Potato' : 'Usuario'}: ${m.content}`).join('\n\n');

    const geminiRes = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: conversationPrompt,
      config: {
        systemInstruction: baseSystem,
        temperature,
      }
    });

    return res.json({
      text: geminiRes.text || '',
      usedProvider: 'potato_gemini',
      model: 'gemini-3.8-flash',
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return res.status(500).json({
      error: error.message || 'Error procesando la respuesta del chat de voz.',
    });
  }
});

// Route: High Quality Text-to-Speech (optional neural audio for cava visualizer)
app.post('/api/tts', async (req: Request, res: Response) => {
  try {
    const { text, voice = 'Kore' } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const ai = getGenAI();
    if (!ai) {
      return res.status(503).json({ error: 'Gemini API not configured for server TTS' });
    }

    const ttsResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.slice(0, 400),
              speechMetadata: {
                style: 'Warm, expressive, natural conversational tone with warm orange glow energy',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice || 'Kore' },
          },
        },
      },
    });

    const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(500).json({ error: 'No audio generated' });
    }

    return res.json({
      audioData: base64Audio,
      sampleRate: 24000,
    });
  } catch (error: any) {
    // If TTS fails (e.g. quota or unsupported), client will fall back to Web Speech API
    return res.status(500).json({ error: error.message });
  }
});

// Route: Transcribe audio recording (native fallback for Chromium/Firefox on Linux)
app.post('/api/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioData, mimeType = 'audio/webm' } = req.body;
    if (!audioData) {
      return res.status(400).json({ error: 'No audio data provided' });
    }

    const ai = getGenAI();
    if (!ai) {
      return res.status(503).json({ error: 'No hay API Key configurada para transcripción de audio en el servidor.' });
    }

    const cleanBase64 = audioData.replace(/^data:[^;]+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType.split(';')[0],
            data: cleanBase64,
          },
        },
        {
          text: 'Transcribe el audio de este mensaje de voz con total fidelidad en español. Devuelve EXCLUSIVAMENTE el texto transcrito de lo que dice el usuario, sin comillas, sin introducciones ni comentarios.',
        },
      ],
    });

    const transcription = response.text ? response.text.trim() : '';
    return res.json({ text: transcription });
  } catch (error: any) {
    console.error('Transcription error:', error);
    return res.status(500).json({ error: error.message || 'Error al transcribir audio' });
  }
});

// Setup Vite or Static serve
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    // In Docker / production, server.js might be inside dist or at root
    const distPath = __dirname.endsWith('dist') ? __dirname : path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🥔 Potato Voice Chat server online:`);
    console.log(`   👉 Abre en tu navegador: http://localhost:${PORT}`);
    console.log(`   📡 Red local:            http://0.0.0.0:${PORT}`);
  });
}

startServer();
