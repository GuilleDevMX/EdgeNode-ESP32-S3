// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteCompression from 'vite-plugin-compression';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Hardening DevSecOps: Pre-compresión estática. 
    // El ESPAsyncWebServer enviará el header 'Content-Encoding: gzip' automáticamente.
    viteCompression({ 
      algorithm: 'gzip',
      ext: '.gz',
      deleteOriginFile: true, // Borramos el .js/.css original para no ocupar el doble en la Flash
      threshold: 0            // Comprimir absolutamente todo
    })
  ],
  base: './', // CRÍTICO: Fuerza rutas relativas para evitar errores 404 en el ESP32
  build: {
    sourcemap: true, // Lighthouse: generar source maps para facilitar el debugging
    chunkSizeWarningLimit: 1500, // Elevamos el límite del warning de Vite
    // Desplegamos directamente en la carpeta de PlatformIO
    outDir: resolve(__dirname, '../data/www'),
    emptyOutDir: true, // Limpia el build anterior
    rollupOptions: {
      output: {
        // Empaquetado Monolítico: Obligamos a Vite a generar 1 solo archivo JS y 1 CSS.
        // Esto evita que el navegador haga 20 peticiones HTTP simultáneas al ESP32.
        manualChunks: undefined,
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
});