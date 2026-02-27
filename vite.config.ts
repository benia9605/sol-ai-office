/**
 * @file vite.config.ts
 * @description Vite 빌드 설정
 * - React 플러그인 활성화 (JSX 변환, Fast Refresh)
 * - 개발 서버 및 프로덕션 빌드 설정
 * - 추후 프록시, 환경변수 등 설정 추가 가능
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/aladin': {
        target: 'http://www.aladin.co.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/aladin/, '/ttb/api'),
      },
      '/api/claude': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/claude/, ''),
        headers: {
          Origin: '',
        },
      },
      '/api/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, ''),
        headers: {
          Origin: '',
        },
      },
      '/api/perplexity': {
        target: 'https://api.perplexity.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/perplexity/, ''),
        headers: {
          Origin: '',
        },
      },
      '/api/yes24': {
        target: 'https://www.yes24.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yes24/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
            proxyReq.removeHeader('sec-fetch-mode');
            proxyReq.removeHeader('sec-fetch-site');
            proxyReq.removeHeader('sec-fetch-dest');
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
          });
        },
      },
    },
  },
})
