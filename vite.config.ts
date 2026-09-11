import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: '/aitools/architect/',
      publicDir: '../public',
      server: {
        port: 3000,
        host: '0.0.0.0',
        strictPort: false,
        origin: 'http://localhost:3000',
        proxy: {
          // 内容登记 beacon（watermarkService 以同域裸路径 /api/content 调用）
          '/api/content': {
            target: 'http://localhost:3002',
            changeOrigin: true,
            timeout: 30000
          },
          // ===== 子应用 /aitools/architect 下的接口（dev base 与 vite base 一致）=====
          '/aitools/architect/api/auth': {
            target: 'https://api.kbitai.com.cn',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/aitools\/architect/, ''),
            // api.kbitai.com.cn 已部署专属 LiteSSL 证书（2026-09-11 验证通过），保持严格证书校验
            secure: true,
            timeout: 30000
          },
          '/aitools/architect/api/user': {
            target: 'https://api.kbitai.com.cn',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/aitools\/architect/, ''),
            secure: true,
            timeout: 30000
          },
          '/aitools/architect/api/usage': {
            target: 'https://api.kbitai.com.cn',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/aitools\/architect/, ''),
            secure: true,
            timeout: 30000
          },
          '/aitools/architect/api/analyze': {
            target: 'https://api.kbitai.com.cn',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/aitools\/architect/, ''),
            secure: true,
            timeout: 30000
          },
          '/aitools/architect/api/search': {
            target: 'https://api.kbitai.com.cn',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/aitools\/architect/, ''),
            secure: true,
            timeout: 30000
          },
          // PH8 用户信息（用户等级）走生产后端（必须排在通用 /api/ph8 之前，避免被 wellai 通配捕获）
          '/aitools/architect/api/ph8/user-info': {
            target: 'https://api.kbitai.com.cn',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/aitools\/architect/, ''),
            secure: true,
            timeout: 30000
          },
          // PH8 用量类接口属自家后端（ph8UsageService 多候选），必须排在 wellai 通配之前
          '^/aitools/architect/api/ph8(-openai)?/(usage|dashboard|users)': {
            target: 'https://api.kbitai.com.cn',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/aitools\/architect/, ''),
            secure: true,
            timeout: 30000
          },
          '/aitools/architect/api/ph8': {
            target: 'https://wellai.cc',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/aitools\/architect\/api\/ph8/, '/v1'),
            headers: {
              'Authorization': `Bearer ${env.PH8_GATEWAY_KEY}`
            },
            secure: true,
            timeout: 300000,
            proxyTimeout: 300000
          },
          '/aitools/architect/api/ph8-openai': {
            target: 'https://wellai.cc',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/aitools\/architect\/api\/ph8-openai/, '/openai/v1'),
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
        },
        dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'use-sync-external-store']
      },
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: true,
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
