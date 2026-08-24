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

// ── AI 키는 서버에서만 주입 (브라우저 번들에 노출 금지 · 감사 C1) ──
// Replit Secret 이름이 VITE_ 접두여도 server.js는 process.env로 읽는다(폴백 포함).
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || '';
const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '';
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY || process.env.VITE_PERPLEXITY_API_KEY || '';
const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SB_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

// 로그인한 유저만 AI 프록시를 쓰게 (오픈 프록시 남용 방지).
// 브라우저는 헤더 x-sb-auth 로 Supabase 액세스 토큰을 보낸다.
// ★ 보안: Supabase 환경변수가 없으면(오설정) fail-OPEN 하면 AI 프록시가 무인증
//   오픈 프록시가 되어 크레딧이 털린다. 반드시 fail-CLOSED(차단).
async function requireAuth(req, res, next) {
  if (!SB_URL || !SB_ANON) { console.error('[proxy] Supabase env 미설정 — AI 프록시 차단(fail-closed)'); return res.status(503).json({ error: 'auth_unavailable' }); }
  const token = req.headers['x-sb-auth'];
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: SB_ANON } });
    if (!r.ok) return res.status(401).json({ error: 'unauthorized' });
    return next();
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

// ── AI 프록시 (키 서버 주입 + 인증) ──
app.use('/api/claude', requireAuth, createProxyMiddleware({
  target: 'https://api.anthropic.com',
  changeOrigin: true,
  pathRewrite: { '^/api/claude': '' },
  headers: { Origin: '' },
  onProxyReq: (proxyReq) => {
    if (ANTHROPIC_KEY) proxyReq.setHeader('x-api-key', ANTHROPIC_KEY);
    proxyReq.removeHeader('x-sb-auth');
  },
}));

app.use('/api/openai', requireAuth, createProxyMiddleware({
  target: 'https://api.openai.com',
  changeOrigin: true,
  pathRewrite: { '^/api/openai': '' },
  headers: { Origin: '' },
  onProxyReq: (proxyReq) => {
    if (OPENAI_KEY) proxyReq.setHeader('Authorization', `Bearer ${OPENAI_KEY}`);
    proxyReq.removeHeader('x-sb-auth');
  },
}));

app.use('/api/perplexity', requireAuth, createProxyMiddleware({
  target: 'https://api.perplexity.ai',
  changeOrigin: true,
  pathRewrite: { '^/api/perplexity': '' },
  headers: { Origin: '' },
  onProxyReq: (proxyReq) => {
    if (PERPLEXITY_KEY) proxyReq.setHeader('Authorization', `Bearer ${PERPLEXITY_KEY}`);
    proxyReq.removeHeader('x-sb-auth');
  },
}));

// 알라딘 — 직접 fetch (리다이렉트를 서버에서 처리하여 CORS 우회)
app.use('/api/aladin', async (req, res) => {
  try {
    const targetPath = req.originalUrl.replace(/^\/api\/aladin/, '/ttb/api');
    const targetUrl = `https://www.aladin.co.kr${targetPath}`;
    const response = await fetch(targetUrl, { redirect: 'follow' });
    const text = await response.text();
    res.set('Content-Type', response.headers.get('content-type') || 'application/json');
    res.status(response.status).send(text);
  } catch (err) {
    console.error('알라딘 프록시 에러:', err);
    res.status(500).json({ error: '알라딘 API 요청 실패' });
  }
});

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
