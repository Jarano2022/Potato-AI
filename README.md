# 🥔 Potato — Hermes Voice Console

> **Consola de chat de voz interactiva en tiempo real con visualizador de audio mono estilo CAVA, conectada directamente con [Hermes Agent](https://hermes-agent.ai/) y modelos Nous Hermes.**

---

## 📑 Tabla de Contenidos
1. [Descripción General](#-descripción-general)
2. [Características Principales](#-características-principales)
3. [Arquitectura del Sistema](#-arquitectura-del-sistema)
4. [Requisitos Previos](#-requisitos-previos)
5. [Instalación y Uso Rápido (Scripts de 1 Clic)](#-instalación-y-uso-rápido-scripts-de-1-clic)
   - [Para macOS y Linux (`start.sh`)](#para-macos-y-linux-startsh)
   - [Para Windows (`start.bat`)](#para-windows-startbat)
6. [Instalación Manual con Node.js](#-instalación-manual-con-nodejs)
7. [Instalación con Docker y Docker Compose](#-instalación-con-docker-y-docker-compose)
8. [Cómo Conectarse con Hermes](#-cómo-conectarse-con-hermes)
   - [1. Hermes Agent Local (`hermes-agent.ai`)](#1-hermes-agent-local-hermes-agentai)
   - [2. Nous Portal / Hermes Gateway (Nube)](#2-nous-portal--hermes-gateway-nube)
   - [3. OpenRouter (Hermes 3)](#3-openrouter-hermes-3)
   - [4. Ollama Local](#4-ollama-local)
9. [Uso de la Aplicación](#-uso-de-la-aplicación)
10. [Estructura del Proyecto](#-estructura-del-proyecto)
11. [Diagnóstico y Preguntas Frecuentes (FAQ)](#-diagnóstico-y-preguntas-frecuentes-faq)

---

## 🌟 Descripción General

**Potato** es un frontend web de chat de voz inteligente diseñado específicamente para integrarse de forma fluida con **Hermes Agent** y la familia de modelos de lenguaje **Hermes (Nous Research)**.

La aplicación permite mantener conversaciones de voz fluidas y de baja latencia con el agente inteligente, mientras un ecualizador balístico dinámico inspirado en la popular herramienta de terminal **CAVA** visualiza la energía y frecuencias de la voz humana y las respuestas del agente en un único canal de **audio mono**.

---

## ✨ Características Principales

- 🎙️ **Chat de Voz Bidireccional en Tiempo Real**:
  - Reconocimiento de voz continuo en el cliente mediante la Web Speech API con soporte nativo de lenguaje natural en español.
  - Síntesis de voz (TTS) con selección de voces del navegador y generación neuronal.
  - Alternancia automática de turnos de conversación con **Modo Manos Libres (*Hands-Free*)**.
  - Interrupción instantánea (*Barge-in*): presiona el botón central o el atajo para pausar la respuesta en cualquier momento.

- 📊 **Visualizador de Audio Mono estilo CAVA**:
  - Procesamiento espectral mediante la **Web Audio API** (`AudioContext` y `AnalyserNode` con FFT de 512 bins).
  - Simulación física de inercia balística: subida inmediata de barras, desaceleración por gravedad y picos flotantes sostenidos (*peak hold caps*).
  - Controles en tiempo real: ajusta el número de barras (de 24 a 64), sensibilidad de ganancia (0.8x a 3.0x) y estilo de barra (sólido o segmentado).
  - Modo *"Probar Cava"* para simular señales armónicas sintéticas sin necesidad de micrófono.

- 🤖 **Integración Directa con Hermes Agent (`hermes-agent.ai`)**:
  - Compatible de forma nativa con el servidor de API oficial de **Hermes Agent** (puerto `8642`).
  - Soporta **Nous Portal Gateway**, **OpenRouter**, **Ollama** o cualquier endpoint OpenAI-compatible personalizado (vLLM, Together AI, etc.).
  - Persistencia de credenciales y endpoints en el navegador local (`localStorage`), manteniendo la privacidad de tus claves API.

- 📈 **Panel de Telemetría y Diagnóstico en Vivo**:
  - Medidor de latencia de red en milisegundos (`ms`).
  - Nivel pico de entrada de micrófono en decibelios (`dB`).
  - Frecuencia de muestreo activa (`kHz`).
  - Verificación de enlace interactiva con botón de ping para comprobar la respuesta del servidor antes de iniciar.

- 🐳 **Preparado para Docker y Producción**:
  - `Dockerfile` multi-stage ligero basado en Alpine Linux con usuario no privilegiado y healthchecks automáticos.
  - `docker-compose.yml` preconfigurado con resolución de host (`host.docker.internal`).

---

## 🏗️ Arquitectura del Sistema

```text
┌────────────────────────────────────────────────────────┐
│                   NAVEGADOR DEL USUARIO                │
│                                                        │
│  [ Micrófono ] ──> Web Audio API (Canal Mono 1.0)     │
│        │                        │                      │
│        ▼                        ▼                      │
│   Web Speech API         Visualizador CAVA             │
│        │                   (Render Canvas)             │
│        ▼                                               │
│  Texto Capturado                                       │
│        │                                               │
│        ▼                                               │
│   hermesClient.ts                                      │
│        │                                               │
└────────┼───────────────────────────────────────────────┘
         │ (HTTP REST / OpenAI Chat Completions)
         ▼
┌────────────────────────────────────────────────────────┐
│             HERMES AGENT / NOUS PORTAL / OLLAMA        │
│                                                        │
│  • Hermes Agent Local (http://127.0.0.1:8642/v1)      │
│  • Nous Portal Gateway (api.nousresearch.com/v1)       │
│  • OpenRouter Cloud (openrouter.ai/api/v1)             │
└────────────────────────────────────────────────────────┘
```

---

## 📋 Requisitos Previos

Solo necesitas tener instalado **uno** de los siguientes entornos:

- **Opción A (Recomendada):** [Node.js](https://nodejs.org/) versión 18 o superior.
- **Opción B (Contenedores):** [Docker](https://www.docker.com/) y Docker Compose.

*(Nota: Los scripts automáticos detectarán automáticamente si tienes Node o Docker instalado).*

---

## ⚡ Instalación y Uso Rápido (Scripts de 1 Clic)

Se han creado scripts interactivos que se encargan de todo: verificar requisitos, instalar dependencias, construir el proyecto, iniciar el servidor y abrir tu navegador automáticamente.

### Para macOS y Linux (`start.sh`)

1. Abre tu terminal en la carpeta del proyecto.
2. Da permisos de ejecución al script (solo la primera vez):
   ```bash
   chmod +x start.sh
   ```
3. Ejecuta el script:
   ```bash
   ./start.sh
   ```
4. El script te mostrará un menú intuitivo:
   - `1) Iniciar en Modo Desarrollo (Recomendado para cambios en vivo)`
   - `2) Iniciar con Docker / Docker Compose`
   - `3) Compilar y arrancar en Producción`
   - `4) Solo instalar dependencias (npm install)`
   - `5) Salir`

El navegador se abrirá automáticamente en `http://localhost:3000`.

---

### Para Windows (`start.bat`)

1. Haz **doble clic** sobre el archivo `start.bat` o ejecútalo desde la consola (`cmd` o `PowerShell`):
   ```cmd
   start.bat
   ```
2. Aparecerá una consola gráfica con las opciones para iniciar con Node.js o Docker.
3. El script abrirá tu navegador automáticamente en `http://localhost:3000`.

---

## 📦 Instalación Manual con Node.js

Si prefieres ejecutar los comandos estándar de Node:

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Iniciar servidor de desarrollo:**
   ```bash
   npm run dev
   ```

3. **Abrir en el navegador:**
   Visita [http://localhost:3000](http://localhost:3000).

4. **(Opcional) Compilar para producción:**
   ```bash
   npm run build
   npm run start
   ```

---

## 🐳 Instalación con Docker y Docker Compose

Si prefieres ejecutar la aplicación de forma aislada en un contenedor:

1. **Construir y levantar el contenedor en segundo plano:**
   ```bash
   docker compose up -d --build
   ```

2. **Ver logs en tiempo real:**
   ```bash
   docker compose logs -f
   ```

3. **Detener el contenedor:**
   ```bash
   docker compose down
   ```

La app estará disponible en [http://localhost:3000](http://localhost:3000).

---

## 🔗 Cómo Conectarse con Hermes

Haz clic en el botón **"Configuración"** (o el botón naranja en el banner superior) para elegir tu motor de Hermes:

### 1. Hermes Agent Local (`hermes-agent.ai`)
Si tienes instalado Hermes Agent en tu computadora:
1. En tu archivo de configuración de Hermes (`~/.hermes/.env`), asegúrate de habilitar el servidor de API:
   ```env
   API_SERVER_ENABLED=true
   API_SERVER_HOST=0.0.0.0
   API_SERVER_PORT=8642
   API_SERVER_KEY=mi_clave_opcional
   ```
2. Inicia tu agente ejecutando en tu terminal:
   ```bash
   hermes
   # o
   hermes agent
   ```
3. En la interfaz web de Potato:
   - Selecciona **"Hermes Agent Local"**.
   - El endpoint se auto-configura en: `http://127.0.0.1:8642/v1/chat/completions`
   - Si definiste `API_SERVER_KEY`, escríbela en el campo de clave; de lo contrario, déjalo vacío.
   - Haz clic en **"Verificar Conexión"** y luego en **"Guardar Configuración"**.

*(Si ejecutas Potato dentro de un contenedor Docker, usa `http://host.docker.internal:8642/v1/chat/completions`).*

---

### 2. Nous Portal / Hermes Gateway (Nube)
Para usar la infraestructura oficial en la nube de Nous Research:
1. En Configuración, selecciona **"Nous Portal Gateway"**.
2. Endpoint: `https://api.nousresearch.com/v1/chat/completions`
3. Modelo: `hermes-3-llama-3.1-405b` (o tu modelo preferido).
4. Introduce tu API Key de Nous Portal.
5. Pulsa **Guardar**.

---

### 3. OpenRouter (Hermes 3)
1. En Configuración, selecciona **"Hermes 3 (OpenRouter)"**.
2. Endpoint: `https://openrouter.ai/api/v1/chat/completions`
3. Modelo: `nousresearch/hermes-3-llama-3.1-8b`
4. Pega tu API Key de OpenRouter (empieza con `sk-or-v1-...`).
5. Pulsa **Guardar**.

---

### 4. Ollama Local
1. Descarga el modelo en tu terminal:
   ```bash
   ollama run hermes3
   ```
2. En Configuración, selecciona **"Hermes Ollama"**.
3. Endpoint: `http://localhost:11434/v1/chat/completions` (no requiere clave).
4. Pulsa **Guardar**.

---

## 🎮 Uso de la Aplicación

1. **Hablar con Potato:**
   - Haz clic en el **círculo grande naranja central** con el icono de micrófono.
   - Cuando el navegador lo solicite, haz clic en **"Permitir"** para el acceso al micrófono.
   - Habla en español de forma natural (ejemplo: *"Hola Potato, preséntate y dime qué puedes hacer"*).
   - Verás tus palabras transcribirse en pantalla y las barras **CAVA** reaccionar a las frecuencias de tu voz.

2. **Modo Manos Libres (*Hands-Free*):**
   - Pulsa el botón **"Modo Manos Libres: Activado"**.
   - Ahora podrás conversar continuamente: Potato hablará y, en cuanto termine, volverá a escuchar automáticamente sin que tengas que pulsar el botón cada vez.

3. **Interrumpir la voz:**
   - Si Potato está hablando y deseas pararlo, pulsa el botón central (ahora en rojo/parar) o el botón de parada.

4. **Ajustar el Visualizador CAVA:**
   - Abre la modal de configuración para cambiar la cantidad de barras (24 a 64), la sensibilidad del ecualizador y el estilo visual (sólido o segmentado).

---

## 📂 Estructura del Proyecto

```text
├── Dockerfile                   # Construcción multi-stage de producción para Docker
├── docker-compose.yml           # Orquestación de contenedores Docker
├── start.sh                     # Script interactivo de inicio para macOS y Linux
├── start.bat                    # Script interactivo de inicio para Windows
├── package.json                 # Scripts npm y dependencias
├── server.ts                    # Servidor backend Express para proxy y estáticos
├── index.html                   # Documento HTML principal
├── src/
│   ├── main.tsx                 # Punto de entrada de React
│   ├── App.tsx                  # Componente principal y máquina de estados de voz
│   ├── index.css                # Tailwind CSS v4 y tipografías
│   ├── components/
│   │   ├── TopBar.tsx           # Barra superior con navegación y acceso a ajustes
│   │   ├── CavaVisualizer.tsx   # Motor Canvas del ecualizador balístico CAVA
│   │   ├── VoiceController.tsx  # Hub central con botón de micrófono y atajos
│   │   ├── ChatTranscript.tsx   # Historial de conversación con copia y reproducción
│   │   ├── AudioStatsWidget.tsx # Widget de telemetría (latencia, dB, sample rate)
│   │   └── HermesSettingsModal.tsx # Modal de configuración de endpoints y claves
│   └── utils/
│       ├── audioEngine.ts       # Web Audio API, analizador FFT y mezclador mono
│       ├── speechEngine.ts      # Web Speech API para reconocimiento y TTS
│       └── hermesClient.ts      # Cliente directo hacia la API de Hermes
```

---

## ❓ Diagnóstico y Preguntas Frecuentes (FAQ)

### 1. El navegador no escucha mi voz
- Asegúrate de haber concedido permisos de micrófono en la barra de direcciones del navegador.
- Comprueba que tu micrófono esté seleccionado como predeterminado en la configuración de sonido de tu sistema operativo.
- Pulsa el botón **"Probar Cava (Test Audio)"** para verificar que el sistema de audio interno funcione correctamente.

### 2. Error de conexión con Hermes Agent
- Comprueba que el servidor de Hermes Agent esté activo ejecutando `curl http://127.0.0.1:8642/v1/models` en tu terminal.
- Si usas Docker en Linux y te conectas a tu máquina anfitriona, asegúrate de que el endpoint sea `http://host.docker.internal:8642/v1/chat/completions`.
- En OpenRouter, revisa que tu saldo de créditos no esté agotado y que tu clave comience por `sk-or-v1-...`.

### 3. ¿Mis claves se envían a algún servidor externo de Potato?
- **No.** Todo se almacena únicamente en el `localStorage` de tu propio navegador web y las llamadas se realizan directamente contra el endpoint que tú mismo configures.

---

**Desarrollado con 🥔 para la comunidad de Hermes y Nous Research.**
