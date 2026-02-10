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
      rollupOptions: {
        output: {
          // جدا کردن کتابخانه‌ها در یک فایل مجزا برای لود سریع‌تر و اطمینان از بسته‌بندی کامل
          manualChunks: {
            'vendor': ['react', 'react-dom', 'recharts', 'lucide-react', 'xlsx'],
          }
        }
      },
      // جلوگیری از خرد شدن بیش از حد فایل‌ها
      cssCodeSplit: false,
      chunkSizeWarningLimit: 1000,
    },
    server: {
      port: 3000
    }
  };
});
