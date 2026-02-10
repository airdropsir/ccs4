
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// Import process explicitly to resolve TypeScript errors in Node.js environment
import process from 'node:process';

export default defineConfig(({ mode }) => {
  // بارگذاری متغیرهای محیطی از سیستم (Vercel)
  // Use process.cwd() from node:process to find the project root
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // جلوگیری از خطای نبود process در مرورگر
      'process.env': {
        API_KEY: env.API_KEY
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: false
    },
    server: {
      port: 3000
    }
  };
});
