import {defineConfig} from 'vite';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.js'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
