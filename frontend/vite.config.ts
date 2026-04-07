import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteCompression from 'vite-plugin-compression';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Hardening: Pre-compresión para LwIP. Ahorra RAM y CPU en el ESP32.
    viteCompression({ 
      algorithm: 'gzip',
      ext: '.gz',
      deleteOriginFile: true, // Eliminamos el original para ahorrar espacio en la Flash
      threshold: 0            // Comprimir TODO
    })
  ],
  base: './', // CRÍTICO: Fuerza el uso de rutas relativas
  build: {
    chunkSizeWarningLimit: 1000, // Aumenta el límite para evitar warnings con archivos grandes
    // Redirige el build a la partición LittleFS del ESP32
    outDir: resolve(__dirname, '../data/www'),
    emptyOutDir: true, // Limpia el build anterior automáticamente
    rollupOptions: {
      output: {
        // Empaquetado monolítico: Reduce conexiones HTTP simultáneas
        manualChunks: undefined,
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
});