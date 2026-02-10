import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env': {
        API_KEY: env.API_KEY
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      // اطمینان از اینکه همه ماژول‌ها در بسته نهایی قرار می‌گیرند
      rollupOptions: {
        output: {
          manualChunks: undefined
        }
      }
    },
    server: {
      port: 3000
    }
  };
});
