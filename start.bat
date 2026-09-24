@echo off
setlocal enabledelayedexpansion
title Potato - Hermes Voice Console Launcher
color 0E

cls
echo ============================================================
echo      ____        __        __        
echo     / __ \____  / /_____ _/ /_____   
echo    / /_/ / __ \/ __/ __ `/ __/ __ \  
echo   / ____/ /_/ / /_/ /_/ / /_/ /_/ /  
echo  /_/    \____/\__/\__,_/\__/\____/   
echo ============================================================
echo   POTATO - Hermes Voice Console ^| Lanzador Windows
echo   https://hermes-agent.ai/
echo ============================================================
echo.

:: Detect Node.js
where node >nul 2>nul
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
    echo   [OK] Node.js detectado: !NODE_VER!
    set HAS_NODE=1
) else (
    echo   [!] Node.js NO esta instalado.
    set HAS_NODE=0
)

:: Detect Docker
where docker >nul 2>nul
if %errorlevel% equ 0 (
    echo   [OK] Docker detectado.
    set HAS_DOCKER=1
) else (
    echo   [!] Docker NO detectado.
    set HAS_DOCKER=0
)
echo ------------------------------------------------------------
echo.

:MENU
echo Selecciona como deseas iniciar Potato:
echo.
echo   [1] Iniciar con Node.js (Modo Desarrollo - Recomendado)
echo   [2] Iniciar con Docker / Docker Compose
echo   [3] Compilar y Ejecutar en Produccion (Node.js)
echo   [4] Solo instalar dependencias (npm install)
echo   [5] Salir
echo.
set /p OPTION="Elige una opcion (1-5, defecto 1): "
if "%OPTION%"=="" set OPTION=1

if "%OPTION%"=="1" goto START_DEV
if "%OPTION%"=="2" goto START_DOCKER
if "%OPTION%"=="3" goto START_PROD
if "%OPTION%"=="4" goto INSTALL_DEPS
if "%OPTION%"=="5" goto EXIT
goto INVALID

:START_DEV
if %HAS_NODE% equ 0 (
    echo.
    color 0C
    echo ERROR: Se requiere Node.js para esta opcion.
    echo Descargalo desde: https://nodejs.org/
    pause
    goto MENU
)
echo.
echo Comprobando dependencias...
if not exist node_modules (
    echo Instalando modulos de Node.js por primera vez...
    call npm install
)
echo.
echo Iniciando servidor y abriendo navegador...
start http://localhost:3000
call npm run dev
goto EXIT

:START_DOCKER
if %HAS_DOCKER% equ 0 (
    echo.
    color 0C
    echo ERROR: Docker Desktop no esta instalado o no esta en el PATH.
    pause
    goto MENU
)
echo.
echo Construyendo y levantando contenedor con Docker Compose...
call docker compose up -d --build
echo.
echo Abriendo navegador en http://localhost:3000...
start http://localhost:3000
echo.
echo Mostrando logs del contenedor (Presiona Ctrl+C para salir de los logs)...
call docker compose logs -f
goto EXIT

:START_PROD
if %HAS_NODE% equ 0 (
    echo.
    color 0C
    echo ERROR: Se requiere Node.js.
    pause
    goto MENU
)
echo.
echo Compilando para produccion...
if not exist node_modules call npm install
call npm run build
echo Iniciando en produccion...
start http://localhost:3000
call npm run start
goto EXIT

:INSTALL_DEPS
echo.
echo Ejecutando npm install...
call npm install
echo Dependencias instaladas con exito.
pause
goto MENU

:INVALID
echo Opcion no valida. Intentalo de nuevo.
pause
goto MENU

:EXIT
echo.
echo Cerrando consola de Potato. Hasta la proxima!
timeout /t 2 >nul
exit /b 0
