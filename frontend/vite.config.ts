import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8080' } },
  build: {
    // Build the main customer app for the production site; the prototype remains available only when running the dedicated prototype build.
    rollupOptions: { input: { main: 'index.html' } },
  },
});
