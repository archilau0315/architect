import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: '/architect/',
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/ph8': {
            target: 'https://ph8.co',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/ph8/, '/v1'),
            secure: true,
            timeout: 120000,
            proxyTimeout: 120000
          },
          '/api/ph8-openai': {
            target: 'https://ph8.co',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/ph8-openai/, '/openai/v1'),
            secure: true,
            timeout: 120000,
            proxyTimeout: 120000
          }
        }
      },
      plugins: [react()],
      define: {
        // API Key 不再注入前端，改由后端管理
        'process.env.API_KEY': JSON.stringify(''),
        'process.env.GEMINI_API_KEY': JSON.stringify('')
      },
      optimizeDeps: {
        exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core', '@ffmpeg/util']
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: mode === 'production',
            drop_debugger: mode === 'production'
          }
        }
      }
    };
});
