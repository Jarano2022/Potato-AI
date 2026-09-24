# 🥔 Potato Voice Chat — Docker Guide

Este proyecto está 100% preparado para ejecutarse y desplegarse con **Docker** y **Docker Compose**, tanto en desarrollo como en producción.

---

## 🚀 Inicio Rápido con Docker Compose

Para levantar Potato Voice Chat en un contenedor listo para usar:

```bash
docker compose up -d --build
```

Abre en tu navegador:
👉 **[http://localhost:3000](http://localhost:3000)**

Para detener los contenedores:
```bash
docker compose down
```

---

## 🛠️ Ejecución con Docker CLI estándar

### 1. Construir la imagen:
```bash
docker build -t potato-hermes-voice .
```

### 2. Ejecutar el contenedor:
```bash
docker run -d -p 3000:3000 --name potato_voice potato-hermes-voice
```

---

## 🔌 Conectar con Hermes Agent (hermes-agent.ai)

### Escenario A: Hermes Agent ejecutándose en tu máquina anfitriona (Host)
Si tienes Hermes Agent instalado en tu sistema local escuchando en el puerto `8642`:
1. Asegúrate de tener en tu `~/.hermes/.env`:
   ```bash
   API_SERVER_ENABLED=true
   API_SERVER_HOST=0.0.0.0
   API_SERVER_PORT=8642
   ```
2. En la interfaz web de Potato, entra en **Configuración**:
   - Para conexiones desde el navegador web de tu máquina: `http://127.0.0.1:8642/v1/chat/completions`
   - O si usas el proxy del contenedor: `http://host.docker.internal:8642/v1/chat/completions`

### Escenario B: Conexión con Nous Portal (Hermes Cloud)
1. En **Configuración**, elige **Nous Portal Gateway**.
2. Introduce tu API Key y pulsa **Verificar Conexión**.

---

## 🐳 Estructura de Docker
- **`Dockerfile`**: Compilación multi-stage ultra ligera basada en `node:22-alpine` con healthcheck incluido y usuario `node` sin privilegios.
- **`docker-compose.yml`**: Configuración con mapeo de puertos `3000:3000`, reinicio automático y resolución de red `host.docker.internal`.
- **`.dockerignore`**: Excluye `node_modules`, `dist` y temporales para acelerar las builds.
