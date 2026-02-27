/**
 * @file server.js
 * @description 프로덕션 Express 서버
 * - vite.config.ts의 proxy 설정을 Express로 구현
 * - /api/claude, /api/openai, /api/perplexity, /api/aladin, /api/yes24 프록시
 * - dist/ 정적 파일 서빙 + SPA fallback
 * - 포트: 5000
 */
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 5000;

// ── API 프록시 ──

// Claude (Anthropic)
app.use('/api/claude', createProxyMiddleware({
  target: 'https://api.anthropic.com',
  changeOrigin: true,
  pathRewrite: { '^/api/claude': '' },
  headers: { Origin: '' },
}));

// OpenAI
app.use('/api/openai', createProxyMiddleware({
  target: 'https://api.openai.com',
  changeOrigin: true,
  pathRewrite: { '^/api/openai': '' },
  headers: { Origin: '' },
}));

// Perplexity
app.use('/api/perplexity', createProxyMiddleware({
  target: 'https://api.perplexity.ai',
  changeOrigin: true,
  pathRewrite: { '^/api/perplexity': '' },
  headers: { Origin: '' },
}));

// 알라딘
app.use('/api/aladin', createProxyMiddleware({
  target: 'http://www.aladin.co.kr',
  changeOrigin: true,
  pathRewrite: { '^/api/aladin': '/ttb/api' },
}));

// Yes24
app.use('/api/yes24', createProxyMiddleware({
  target: 'https://www.yes24.com',
  changeOrigin: true,
  pathRewrite: { '^/api/yes24': '' },
  onProxyReq: (proxyReq) => {
    proxyReq.removeHeader('origin');
    proxyReq.removeHeader('referer');
    proxyReq.removeHeader('sec-fetch-mode');
    proxyReq.removeHeader('sec-fetch-site');
    proxyReq.removeHeader('sec-fetch-dest');
    proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  },
}));

// ── 정적 파일 서빙 (프로덕션 빌드) ──
app.use(express.static(join(__dirname, 'dist')));

// SPA fallback — 모든 비-API 요청은 index.html로
app.get('/{*path}', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
