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

// Route: Test Hermes connection (e.g. OpenRouter, Ollama, custom URL)
app.post('/api/hermes/test', async (req: Request, res: Response) => {
  try {
    const { endpoint, apiKey, model } = req.body;
    const targetUrl = endpoint || 'https://openrouter.ai/api/v1/chat/completions';
    
    // Quick test prompt
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const payload = {
      model: model || 'nousresearch/hermes-3-llama-3.1-8b',
      messages: [{ role: 'user', content: 'Say "Potato online" in 2 words.' }],
      max_tokens: 15,
      temperature: 0.7,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const apiRes = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return res.status(apiRes.status).json({
        ok: false,
        error: `Error HTTP ${apiRes.status}: ${errText.slice(0, 200)}`,
      });
    }

    const data = await apiRes.json();
    const reply = data.choices?.[0]?.message?.content || 'Conexión exitosa';
    return res.json({ ok: true, reply });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      error: error.message || 'Error conectando con Hermes',
    });
  }
});

// Route: Chat Completion (Hermes or Potato Gemini fallback)
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const {
      messages = [],
      provider = 'hermes_openrouter', // 'hermes_openrouter' | 'hermes_ollama' | 'hermes_custom' | 'potato_gemini'
      model = 'nousresearch/hermes-3-llama-3.1-8b',
      endpoint = 'https://openrouter.ai/api/v1/chat/completions',
      apiKey = '',
      systemPrompt = '',
      temperature = 0.7,
    } = req.body;

    const baseSystem = systemPrompt || 
      'Eres "Potato", un asistente de voz carismático, directo, cálido e ingenioso conectado a Hermes. Tus respuestas se van a reproducir por voz, así que responde en español claro, natural y conciso (máximo 2 a 3 oraciones por turno, a menos que el usuario pida más detalle). No uses listas largas, markdown ni asteriscos innecesarios.';

    // Check if user is routing through Hermes
    if (provider.startsWith('hermes_')) {
      const targetUrl = endpoint || (provider === 'hermes_ollama' ? 'http://localhost:11434/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions');
      
      const formattedMessages = [
        { role: 'system', content: baseSystem },
        ...messages.map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      ];

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      // If calling OpenRouter without user key, and we have server key or fallback
      if (targetUrl.includes('openrouter.ai') && !apiKey) {
        // If no user API key provided for Hermes OpenRouter, check if we can fallback to Gemini
        const ai = getGenAI();
        if (ai) {
          // Fallback to Gemini 3.8 Flash formatted with Hermes Persona
          const chatContents = formattedMessages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          }));

          const geminiRes = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: chatContents.map(c => `${c.role}: ${c.parts[0].text}`).join('\n\n'),
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

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const hermesRes = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: formattedMessages,
          temperature,
          max_tokens: 350,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!hermesRes.ok) {
        const errorText = await hermesRes.text();
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
            warning: `Hermes respondió con error ${hermesRes.status}, usando motor Potato integrado.`,
          });
        }

        return res.status(hermesRes.status).json({
          error: `Hermes API Error (${hermesRes.status}): ${errorText.slice(0, 300)}`,
        });
      }

      const data = await hermesRes.json();
      const outputText = data.choices?.[0]?.message?.content || '';
      return res.json({
        text: outputText,
        usedProvider: provider,
        model,
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
    console.log(`🥔 Potato Voice Chat server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
