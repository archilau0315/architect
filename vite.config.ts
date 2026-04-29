import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: '/architect/',
      publicDir: '../public',
      server: {
        port: 3000,
        host: '0.0.0.0',
        strictPort: false,
        origin: 'http://localhost:3000',
        proxy: {
          '/architect/api/auth': {
            target: 'https://api.kbitai.com.cn',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/architect\/api\/auth/, '/api/auth'),
            secure: true,
            timeout: 30000
          },
          '/api/user': {
            target: 'https://api.kbitai.com.cn',
            changeOrigin: true,
            secure: true,
            timeout: 30000
          },
          '/api/content': {
            target: 'http://localhost:3002',
            changeOrigin: true,
            timeout: 30000
          },
          '/api/usage': {
            target: 'https://api.kbitai.com.cn',
            changeOrigin: true,
            secure: true,
            timeout: 30000
          },
          '/api/analyze': {
            target: 'https://api.kbitai.com.cn',
            changeOrigin: true,
            secure: true,
            timeout: 30000
          },
          '/api/search': {
            target: 'https://api.kbitai.com.cn',
            changeOrigin: true,
            secure: true,
            timeout: 30000
          },
          '/api/ph8/user-info': {
            target: 'http://localhost:3002',
            changeOrigin: true,
          },
          '/architect/api/ph8/user-info': {
            target: 'http://localhost:3002',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/architect/, ''),
          },
          '/api/ph8': {
            target: 'https://ph8.co',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/ph8/, '/v1'),
            headers: {
              'Authorization': `Bearer ${env.PH8_GATEWAY_KEY}`
            },
            secure: true,
            timeout: 300000,
            proxyTimeout: 300000
          },
          '/api/ph8-openai': {
            target: 'https://ph8.co',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/ph8-openai/, '/openai/v1'),
            headers: {
              'Authorization': `Bearer ${env.PH8_GATEWAY_KEY}`
            },
            secure: true,
            timeout: 300000,
            proxyTimeout: 300000
          }
        }
      },
      plugins: [
        react(),
        tailwindcss(),
        {
          name: 'serve-public-dir',
          configureServer(server) {
            server.middlewares.use('/public', (req, res, next) => {
              const filePath = path.resolve(__dirname, '../public', req.url!.slice(1));
              if (fs.existsSync(filePath)) {
                res.end(fs.readFileSync(filePath));
              } else {
                next();
              }
            });
          }
        }
      ],
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
