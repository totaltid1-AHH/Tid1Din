import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react()
  ],
  server: {
    proxy: {
      '/api/gatewayapi': {
        target: 'https://gatewayapi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gatewayapi/, '')
      }
    }
  }
});
