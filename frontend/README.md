# 🌐 EdgeSecOps - Dashboard Frontend (React)

![React + Vite + TypeScript](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white) ![Recharts](https://img.shields.io/badge/Recharts-22B5BF?style=for-the-badge&logo=react&logoColor=white)

Este es el proyecto Frontend para el panel de administración web del sistema EdgeSecOps (ESP32-S3). Es una Single Page Application (SPA) construida con las tecnologías web más modernas y diseñada para ser extremadamente ligera (< 1MB comprimida) para caber perfectamente en la partición LittleFS del microcontrolador.

## 🚀 Tecnologías Core

*   **[React 19](https://react.dev/):** Biblioteca principal de UI.
*   **[Vite](https://vitejs.dev/):** Herramienta de construcción (bundler) ultrarrápida.
*   **[TypeScript](https://www.typescriptlang.org/):** Para un tipado estricto de las interfaces del ESP32 (IoT) y escalabilidad.
*   **[Tailwind CSS](https://tailwindcss.com/):** Framework de utilidades para estilar la interfaz rápidamente sin CSS externo masivo.
*   **[Recharts](https://recharts.org/):** Biblioteca para la visualización de la telemetría y gráficos históricos multi-línea interactivos.
*   **[React Hot Toast](https://react-hot-toast.com/):** Notificaciones (Toasts) amigables para el usuario.

---

## 🛠️ Instalación y Desarrollo Local

### 1. Requisitos
Asegúrate de tener instalado [Node.js](https://nodejs.org/) (se recomienda v20 LTS o superior) y npm.

### 2. Instalar Dependencias
Abre una terminal en este directorio (`frontend/`) y ejecuta:
```bash
npm install
```

### 3. Servidor de Desarrollo
Puedes probar la interfaz web localmente en tu ordenador antes de compilarla para el ESP32:
```bash
npm run dev
```
> **Nota de Mocks (API):** Dado que el ESP32 no está corriendo el servidor en tu localhost:5173, la app intentará conectar con el ESP32 (ver `src/api/client.ts` para configuraciones CORS). Puedes hacer que el ESP32 se conecte a tu misma red Wi-Fi y probar el panel accediendo a su IP o `http://edgenode.local` directamente.

---

## 🏗️ Construcción para Producción (Deploy al ESP32)

Dado que el ESP32-S3 aloja este panel web, es necesario compilar el código de React en archivos estáticos mínimos (`index.html`, `.js`, `.css`) y transferirlos a la carpeta `data/www/` del backend.

### 1. Compilación
Ejecuta el siguiente comando para generar los *assets* de producción minificados:
```bash
npm run build
```
Vite generará los archivos en la carpeta `dist/`.

### 2. Actualización de Archivos
*Actualmente, Vite.config.ts está configurado con `outDir: '../data/www'` (revisar configuración local)*, lo que significa que **este paso ya se hace automáticamente al compilar**. 

Los archivos generados (y comprimidos en GZIP gracias al plugin `vite-plugin-compression`) se enviarán directamente a la carpeta `/data/www` del proyecto matriz en C++.

### 3. Flasheo al ESP32
Una vez compilado, desde la raíz del proyecto PlatformIO, ejecuta la orden de subir el sistema de archivos:
```bash
cd ..
pio run -t uploadfs
```

---

## 📁 Estructura del Código

```text
src/
├── api/            # Cliente Fetch (Intercepción JWT, manejo de errores)
├── assets/         # Imágenes estáticas y CSS global
├── components/     # Componentes reutilizables (Tarjetas, loaders, modales)
├── context/        # Estado global (Auth, Theme, Live Telemetry WebSocket)
├── hooks/          # React Hooks personalizados (useTelemetry, etc.)
├── interfaces/     # Definiciones TypeScript de las respuestas JSON del C++
└── views/          # Pantallas completas de la aplicación
    ├── Dashboard.tsx       # Gráficas y estado en vivo (TinyML, sensores)
    ├── Login.tsx           # Pantalla de inicio de sesión (RBAC)
    ├── Logs/               # Visor de DataLogger (CSV)
    └── Settings/           # Configuración (Red, SMTP, Cloud Webhooks, mTLS, WhatsApp)
```

## 🔐 Seguridad Integrada
El cliente REST y WebSocket inyectan automáticamente el token `Bearer JWT` (guardado en SessionStorage) en cada petición para validar el acceso contra el servidor seguro del ESP32. Si el token expira (Error 401), el cliente deslogueará al usuario forzándolo a autenticarse de nuevo.
