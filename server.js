/**
 * @file server.js
 * @description 프로덕션 Express 서버
 * - vite.config.ts의 proxy 설정을 Express로 구현
 * - /api/claude, /api/openai, /api/perplexity, /api/aladin, /api/yes24 프록시
 * - provider 3종은 requireAuth + requireProviderAllowed(D-007 워크스페이스 정책) 통과 후에만 호출
 * - dist/ 정적 파일 서빙 + SPA fallback
 * - 포트: 5000
 *
 * ⚠️ http-proxy-middleware v3 주의: 옵션 이름이 `on: { proxyReq }` 다.
 *    v2 스타일 최상위 `onProxyReq` 는 조용히 무시된다(검사도 경고도 없다).
 *    이 파일에서 그 실수가 있었고, 그 결과 API 키 미주입 + 유저 토큰 외부 유출이 있었다.
 *    회귀 방지: `node scripts/guard-test.mjs`
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
    const u = await r.json().catch(() => null);
    req.sbUserId = u?.id ?? null;
    return next();
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

// ──────────────────────────────────────────────────────────────
// D-007 서버 정책: 워크스페이스별 모델 provider 호출 차단
// ──────────────────────────────────────────────────────────────
// 공유 폴더 계약 0.2.0 §9 / GPT-R1-O1:
//   "Office 의 시목 workspace 에 대해 cron·수동 직원 실행·이미지/채팅 등 실제 provider 호출에
//    도달하는 서버 경로를 차단한다. UI 숨김이나 일부 import 그래프만으로 비용 경계 완료를 선언하지 않는다."
//
// 구현: 클라이언트는 provider 요청에 헤더 x-ws-id 를 넣는다.
//   - 있으면: **호출자 본인의 JWT로** workspaces 를 조회한다 → RLS(my_workspace_ids)가 멤버십을 증명한다.
//     그 행의 ai_provider_enabled 가 false 면 403. (멤버가 아니면 0행 → 403)
//   - 없으면: 서버가 호출자의 personal 워크스페이스를 찾아 그 정책을 적용한다(개인 공간 기능 보존).
//     이 값은 클라이언트가 고를 수 없으므로 "헤더를 빼서 다른 워크스페이스 정책을 피하는" 우회는 안 된다.
//
// ⚠️ 남는 한계(정직하게 기록): 헤더를 생략하고 손으로 요청을 만들면 personal 정책으로 평가된다.
//   결과를 시목 workspace 기록으로 저장할 수는 없지만(저장 경로는 workspace 를 따로 검사) 호출 자체는 나간다.
//   완전 차단은 provider 호출을 서버 전용 endpoint 로 옮겨 workspace 를 서버가 단독 결정할 때 가능하다.
const POLICY_TTL_MS = 60_000;
const policyCache = new Map(); // key: `${userId}:${wsId||'personal'}` → { allowed, name, at }

async function sbSelect(path, token) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SB_ANON, Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`rest ${r.status}`);
  return r.json();
}

/** 이 요청이 모델 provider 를 호출해도 되는지 판정 */
async function resolveProviderPolicy(req) {
  const token = req.headers['x-sb-auth'];
  const wsId = (req.headers['x-ws-id'] || '').trim();
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (wsId && !uuidRe.test(wsId)) return { allowed: false, code: 'bad_workspace', name: null };

  const key = `${req.sbUserId || 'anon'}:${wsId || 'personal'}`;
  const hit = policyCache.get(key);
  if (hit && Date.now() - hit.at < POLICY_TTL_MS) return hit;

  let rows;
  try {
    rows = wsId
      ? await sbSelect(`workspaces?id=eq.${encodeURIComponent(wsId)}&select=id,name,ai_provider_enabled`, token)
      : await sbSelect('workspaces?type=eq.personal&select=id,name,ai_provider_enabled&limit=1', token);
  } catch (e) {
    // 정책을 확인할 수 없으면 통과시키지 않는다(fail-closed).
    console.error('[proxy] provider 정책 조회 실패 — 차단');
    return { allowed: false, code: 'policy_unavailable', name: null };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    // 멤버가 아니거나 없는 workspace. 존재 여부를 알려주지 않는다.
    return { allowed: false, code: 'workspace_forbidden', name: null };
  }
  // 마이그 060 적용 전이면 컬럼이 없어 undefined → 기존 동작 유지(허용).
  const enabled = rows[0].ai_provider_enabled;
  const out = {
    allowed: enabled !== false,
    code: enabled === false ? 'provider_disabled' : null,
    name: rows[0].name ?? null,
    at: Date.now(),
  };
  policyCache.set(key, out);
  return out;
}

async function requireProviderAllowed(req, res, next) {
  const p = await resolveProviderPolicy(req);
  if (p.allowed) return next();
  if (p.code === 'provider_disabled') {
    return res.status(403).json({
      error: {
        code: 'provider_disabled',
        message: `${p.name ?? '이 워크스페이스'}는 AI 모델 실행이 꺼져 있어요. (D-007: 조사·제작은 구독 GPT/Codex가 맡고 Office는 보관·기록을 맡습니다)`,
        retryable: false,
      },
    });
  }
  return res.status(p.code === 'policy_unavailable' ? 503 : 403).json({
    error: { code: p.code, message: 'AI 모델 실행 권한을 확인할 수 없어요.', retryable: p.code === 'policy_unavailable' },
  });
}

// ── AI 프록시 (키 서버 주입 + 인증) ──
app.use('/api/claude', requireAuth, requireProviderAllowed, createProxyMiddleware({
  target: 'https://api.anthropic.com',
  changeOrigin: true,
  pathRewrite: { '^/api/claude': '' },
  headers: { Origin: '' },
  // ★ http-proxy-middleware v3 는 최상위 onProxyReq 를 무시한다 — 반드시 on.proxyReq 로 등록한다.
  //   (v2 스타일로 두면 콜백이 아예 실행되지 않아 ① API 키가 주입되지 않고
  //    ② 유저의 Supabase 액세스 토큰(x-sb-auth)이 외부 provider 로 전달된다. scripts/guard-test.mjs 로 재현)
  on: {
    proxyReq: (proxyReq) => {
      if (ANTHROPIC_KEY) proxyReq.setHeader('x-api-key', ANTHROPIC_KEY);
      // 내부 전용 헤더는 업스트림으로 보내지 않는다
      proxyReq.removeHeader('x-sb-auth');
      proxyReq.removeHeader('x-ws-id');
    },
  },
}));

app.use('/api/openai', requireAuth, requireProviderAllowed, createProxyMiddleware({
  target: 'https://api.openai.com',
  changeOrigin: true,
  pathRewrite: { '^/api/openai': '' },
  headers: { Origin: '' },
  // ★ http-proxy-middleware v3 는 최상위 onProxyReq 를 무시한다 — 반드시 on.proxyReq 로 등록한다.
  //   (v2 스타일로 두면 콜백이 아예 실행되지 않아 ① API 키가 주입되지 않고
  //    ② 유저의 Supabase 액세스 토큰(x-sb-auth)이 외부 provider 로 전달된다. scripts/guard-test.mjs 로 재현)
  on: {
    proxyReq: (proxyReq) => {
      if (OPENAI_KEY) proxyReq.setHeader('Authorization', `Bearer ${OPENAI_KEY}`);
      // 내부 전용 헤더는 업스트림으로 보내지 않는다
      proxyReq.removeHeader('x-sb-auth');
      proxyReq.removeHeader('x-ws-id');
    },
  },
}));

app.use('/api/perplexity', requireAuth, requireProviderAllowed, createProxyMiddleware({
  target: 'https://api.perplexity.ai',
  changeOrigin: true,
  pathRewrite: { '^/api/perplexity': '' },
  headers: { Origin: '' },
  // ★ http-proxy-middleware v3 는 최상위 onProxyReq 를 무시한다 — 반드시 on.proxyReq 로 등록한다.
  //   (v2 스타일로 두면 콜백이 아예 실행되지 않아 ① API 키가 주입되지 않고
  //    ② 유저의 Supabase 액세스 토큰(x-sb-auth)이 외부 provider 로 전달된다. scripts/guard-test.mjs 로 재현)
  on: {
    proxyReq: (proxyReq) => {
      if (PERPLEXITY_KEY) proxyReq.setHeader('Authorization', `Bearer ${PERPLEXITY_KEY}`);
      // 내부 전용 헤더는 업스트림으로 보내지 않는다
      proxyReq.removeHeader('x-sb-auth');
      proxyReq.removeHeader('x-ws-id');
    },
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
  on: {
    proxyReq: (proxyReq) => {
      proxyReq.removeHeader('origin');
      proxyReq.removeHeader('referer');
      proxyReq.removeHeader('sec-fetch-mode');
      proxyReq.removeHeader('sec-fetch-site');
      proxyReq.removeHeader('sec-fetch-dest');
      proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    },
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
