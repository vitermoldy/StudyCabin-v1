import { defineConfig } from 'vite';

// The server (npm run server) keeps focus history and a copy of the settings in MySQL; dev forwards /api to it.
const api = { '/api': { target: `http://localhost:${process.env.PORT ?? 8794}` } };

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
  },
});
