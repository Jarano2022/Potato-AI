#!/usr/bin/env bash

# ==============================================================================
# 🥔 Potato — Hermes Voice Console | Start Script (macOS & Linux)
# ==============================================================================

set -e

# Color definitions
C_RESET='\033[0m'
C_BOLD='\033[1m'
C_ORANGE='\033[38;5;208m'
C_GREEN='\033[32m'
C_RED='\033[31m'
C_CYAN='\033[36m'
C_YELLOW='\033[33m'
C_GRAY='\033[90m'

clear || true

echo -e "${C_ORANGE}${C_BOLD}"
echo "    ____        __        __        "
echo "   / __ \____  / /_____ _/ /_____   "
echo "  / /_/ / __ \/ __/ __ \`/ __/ __ \  "
echo " / ____/ /_/ / /_/ /_/ / /_/ /_/ /  "
echo "/_/    \____/\__/\__,_/\__/\____/   "
echo -e "${C_RESET}"
echo -e "${C_BOLD}🥔 Potato — Hermes Voice Console | Lanzador Automático${C_RESET}"
echo -e "${C_GRAY}Compatible con macOS y Linux${C_RESET}"
echo -e "${C_GRAY}https://hermes-agent.ai/${C_RESET}"
echo "-------------------------------------------------------------"

# Check dependencies
NODE_INSTALLED=false
NPM_INSTALLED=false
DOCKER_INSTALLED=false

if command -v node >/dev/null 2>&1; then
  NODE_INSTALLED=true
  NODE_VERSION=$(node -v)
fi

if command -v npm >/dev/null 2>&1; then
  NPM_INSTALLED=true
  NPM_VERSION=$(npm -v)
fi

if command -v docker >/dev/null 2>&1; then
  DOCKER_INSTALLED=true
fi

echo -e "${C_CYAN}Diagnóstico de entorno:${C_RESET}"
if [ "$NODE_INSTALLED" = true ]; then
  echo -e "  ✅ Node.js:  ${C_GREEN}${NODE_VERSION}${C_RESET}"
else
  echo -e "  ⚠️  Node.js:  ${C_YELLOW}No encontrado${C_RESET}"
fi

if [ "$NPM_INSTALLED" = true ]; then
  echo -e "  ✅ npm:      ${C_GREEN}v${NPM_VERSION}${C_RESET}"
fi

if [ "$DOCKER_INSTALLED" = true ]; then
  echo -e "  ✅ Docker:   ${C_GREEN}Instalado${C_RESET}"
else
  echo -e "  ⚠️  Docker:   ${C_GRAY}No detectado${C_RESET}"
fi
echo "-------------------------------------------------------------"

# Helper to open browser automatically
open_browser() {
  local URL="http://localhost:3000"
  echo -e "\n${C_GREEN}🚀 Abriendo Potato en tu navegador... (${URL})${C_RESET}"
  sleep 2
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then
    open "$URL" >/dev/null 2>&1 &
  else
    echo -e "${C_CYAN}Por favor abre manualmente:${C_RESET} ${C_BOLD}${URL}${C_RESET}"
  fi
}

# Menu options
echo -e "${C_BOLD}¿Cómo deseas iniciar la aplicación?${C_RESET}"
echo ""
echo -e "  ${C_ORANGE}1)${C_RESET} Iniciar con Node.js (Modo Desarrollo - Rápido)"
echo -e "  ${C_ORANGE}2)${C_RESET} Iniciar con Docker / Docker Compose"
echo -e "  ${C_ORANGE}3)${C_RESET} Compilar y Ejecutar en Producción (Node.js)"
echo -e "  ${C_ORANGE}4)${C_RESET} Solo instalar dependencias (npm install)"
echo -e "  ${C_ORANGE}5)${C_RESET} Salir"
echo ""
read -rp "Selecciona una opción [1-5] (predeterminado 1): " OPTION
OPTION=${OPTION:-1}

case "$OPTION" in
  1)
    if [ "$NODE_INSTALLED" = false ]; then
      echo -e "${C_RED}Error: Node.js no está instalado. Instálalo desde https://nodejs.org o usa la opción 2 (Docker).${C_RESET}"
      exit 1
    fi

    echo -e "\n${C_CYAN}Verificando dependencias en node_modules...${C_RESET}"
    if [ ! -d "node_modules" ]; then
      echo -e "${C_YELLOW}Instalando paquetes por primera vez...${C_RESET}"
      npm install
    fi

    echo -e "\n${C_GREEN}Iniciando servidor de desarrollo...${C_RESET}"
    open_browser &
    npm run dev
    ;;

  2)
    if [ "$DOCKER_INSTALLED" = false ]; then
      echo -e "${C_RED}Error: Docker no está instalado en este sistema.${C_RESET}"
      exit 1
    fi

    echo -e "\n${C_CYAN}Levantando contenedor Potato con Docker Compose...${C_RESET}"
    if docker compose version >/dev/null 2>&1; then
      docker compose up -d --build
    else
      docker-compose up -d --build
    fi

    open_browser
    echo -e "\n${C_GREEN}✅ Contenedor activo. Logs en vivo (Ctrl+C para salir de los logs sin detener el contenedor):${C_RESET}"
    if docker compose version >/dev/null 2>&1; then
      docker compose logs -f
    else
      docker-compose logs -f
    fi
    ;;

  3)
    if [ "$NODE_INSTALLED" = false ]; then
      echo -e "${C_RED}Error: Node.js no está instalado.${C_RESET}"
      exit 1
    fi

    echo -e "\n${C_CYAN}Instalando dependencias si faltan...${C_RESET}"
    if [ ! -d "node_modules" ]; then
      npm install
    fi

    echo -e "\n${C_CYAN}Compilando cliente Vite y servidor de producción...${C_RESET}"
    npm run build

    echo -e "\n${C_GREEN}Iniciando Potato en modo producción...${C_RESET}"
    open_browser &
    npm run start
    ;;

  4)
    echo -e "\n${C_CYAN}Ejecutando npm install...${C_RESET}"
    npm install
    echo -e "${C_GREEN}✅ Dependencias instaladas correctamente.${C_RESET}"
    ;;

  5)
    echo -e "\n${C_GRAY}Saliendo... ¡Hasta pronto!${C_RESET}"
    exit 0
    ;;

  *)
    echo -e "${C_RED}Opción no válida.${C_RESET}"
    exit 1
    ;;
esac
