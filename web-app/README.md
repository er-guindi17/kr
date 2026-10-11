# Sala de ensayo — simulador web local

Aplicación web independiente inspirada en los campos de la interfaz original (PIN, cantidad y nombre base). Sirve para practicar el flujo y observar una lista de participantes y un registro de eventos generado por el propio simulador.

## Límite importante

Esta aplicación no inicia jugadores reales, no valida PINes en Kahoot, no usa el módulo kahoot.js, no llama a Kahoot y no contacta servicios externos. El PIN es solo una etiqueta local. Los registros son simulados y se guardan únicamente en la memoria del proceso; al reiniciar el servidor desaparecen. No introduzcas claves ni credenciales.

Los archivos originales del proyecto, incluida la aplicación Electron de la raíz, se mantienen intactos. Esta versión vive completamente dentro de la carpeta web-app.

## Requisitos

- Node.js 18 o superior.
- No requiere paquetes externos ni claves API.

## Ejecutar

Desde la carpeta web-app:

    npm start

Abre http://localhost:3000. El servidor también respeta la variable PORT del entorno y se enlaza a 0.0.0.0 para admitir el preview o el despliegue de Replit.

Durante el desarrollo puedes usar:

    npm run dev

## Pruebas

    npm test

Las pruebas usan el runner integrado de Node.js y comprueban la validación, el progreso, la detención, el endpoint de salud y el servicio de archivos estáticos.

## Estructura

- main.js: servidor HTTP y API local de simulación.
- public/index.html: estructura de la interfaz.
- public/styles.css: estilos responsive y animaciones respetuosas con reduced-motion.
- public/renderer.js: validación de interfaz, sondeo del progreso y controles.
- test/server.test.js: pruebas automatizadas del servidor.
- package.json: comandos de ejecución y pruebas.

## Publicación

Si despliegas esta versión, publica solo la carpeta web-app y conserva presente el límite anterior: es una herramienta de ensayo con datos simulados, no una integración de Kahoot. No necesita secretos, tokens ni variables de API. La API limita cada ensayo a 100 participantes y a cinco ensayos simultáneos por proceso.