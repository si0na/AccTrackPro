import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy all /api requests to the NestJS backend in development
      '/api': {
        target: process.env.VITE_API_URL || 'http://127.0.0.1:3000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            // Avoid unhandled socket errors when the backend is booting up
            if (res && !res.headersSent && typeof (res as any).writeHead === 'function') {
              (res as any).writeHead(503, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  statusCode: 503,
                  error: 'Service Unavailable',
                  message: 'Backend server is starting up or unavailable. Please retry in a moment.',
                }),
              );
            }
          });
        },
      },
    },
  },
});
