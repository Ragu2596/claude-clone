import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,   // always use 5173, never random port
      proxy: {
        '/api': { target: 'http://localhost:3001', changeOrigin: true },
        '/auth': { target: 'http://localhost:3001', changeOrigin: true },
        '/uploads': { target: 'http://localhost:3001', changeOrigin: true },
        '/payments': { target: 'http://localhost:3001', changeOrigin: true },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
    define: {
      __API_URL__: JSON.stringify(
        isProd
          ? (process.env.VITE_API_URL || '')
          : 'http://localhost:3001'
      ),
    },
  };
});