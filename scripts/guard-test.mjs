/**
 * @file scripts/guard-test.mjs
 * @description 가드 런타임 검사 — server.js provider 정책 + erp-proxy/kpi-ingest 가드 로직
 *
 * 왜 이 파일이 필요한가: GPT 통합 회신이 명시했다 —
 *   "import 그래프 검사만으로 모델 호출 0을 선언하지 않는다",
 *   "UI 숨김이나 일부 import 그래프만으로 비용 경계 완료를 선언하지 않는다".
 * 그래서 **실제 HTTP 요청을 보내고 upstream 으로 나가는지 spy 로 센다.**
 *
 * 범위: server.js 를 실제로 띄우고, Supabase 와 provider upstream 을 가짜 서버로 바꿔
 *   정책 분기를 검증한다. 실제 Anthropic/OpenAI/시목에는 접속하지 않는다.
 *
 * 실행: node scripts/guard-test.mjs
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; failures.push(name + (detail ? ` — ${detail}` : '')); console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

// ── 워크스페이스 픽스처 (실제 운영 UUID 를 쓰지 않는다) ──
const WS_BLOCKED = '11111111-1111-4111-8111-111111111111'; // ai_provider_enabled=false (시목 역할)
const WS_ALLOWED = '22222222-2222-4222-8222-222222222222'; // 다른 브랜드 (운명랩 역할)
const WS_PERSONAL = '33333333-3333-4333-8333-333333333333';
const WS_FOREIGN = '44444444-4444-4444-8444-444444444444'; // 내가 멤버가 아닌 workspace
const TOKEN = 'test-user-token';

// ── 가짜 Supabase (auth + REST, RLS 를 흉내낸다) ──
let supaHits = 0;
const supa = createServer((req, res) => {
  supaHits++;
  const url = new URL(req.url, 'http://x');
  const auth = req.headers.authorization || '';
  const okAuth = auth === `Bearer ${TOKEN}`;

  if (url.pathname === '/auth/v1/user') {
    if (!okAuth) { res.writeHead(401).end('{}'); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 'user-1' }));
    return;
  }
  if (url.pathname === '/rest/v1/workspaces') {
    if (!okAuth) { res.writeHead(401).end('[]'); return; }
    const idEq = url.searchParams.get('id');       // "eq.<uuid>"
    const typeEq = url.searchParams.get('type');   // "eq.personal"
    const rows = [];
    if (typeEq === 'eq.personal') {
      rows.push({ id: WS_PERSONAL, name: '내 오피스', ai_provider_enabled: true });
    } else if (idEq) {
      const id = idEq.replace(/^eq\./, '');
      // ★ RLS 흉내: 멤버가 아닌 workspace 는 0행
      if (id === WS_BLOCKED) rows.push({ id, name: '시목', ai_provider_enabled: false, erp_source: 'simok_api' });
      else if (id === WS_ALLOWED) rows.push({ id, name: '운명랩', ai_provider_enabled: true, erp_source: 'manual' });
      else if (id === WS_PERSONAL) rows.push({ id, name: '내 오피스', ai_provider_enabled: true, erp_source: 'manual' });
      // WS_FOREIGN → 0행
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(rows));
    return;
  }
  res.writeHead(404).end('{}');
});
supa.listen(0);
await once(supa, 'listening');
const SUPA_URL = `http://127.0.0.1:${supa.address().port}`;

// ── 가짜 provider upstream (여기에 요청이 오면 "모델 호출이 나갔다"는 뜻) ──
const providerCalls = [];
const upstream = createServer((req, res) => {
  providerCalls.push({
    url: req.url,
    wsHeader: req.headers['x-ws-id'] ?? null,
    sbAuthLeak: req.headers['x-sb-auth'] ?? null,
    auth: !!req.headers['x-api-key'] || !!req.headers.authorization,
  });
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 1, output_tokens: 1 } }));
});
upstream.listen(0);
await once(upstream, 'listening');
const UP_PORT = upstream.address().port;

// ── server.js 를 띄운다. provider target 을 가짜로 바꾸기 위해 패치본을 만든다 ──
import { readFileSync, writeFileSync, mkdtempSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'guard-'));
let src = readFileSync('server.js', 'utf8')
  .replace("target: 'https://api.anthropic.com'", `target: 'http://127.0.0.1:${UP_PORT}'`)
  .replace("target: 'https://api.openai.com'", `target: 'http://127.0.0.1:${UP_PORT}'`)
  .replace("target: 'https://api.perplexity.ai'", `target: 'http://127.0.0.1:${UP_PORT}'`)
  .replace('const PORT = 5000;', 'const PORT = Number(process.env.TEST_PORT);');
writeFileSync(join(dir, 'server.js'), src);
cpSync('node_modules', join(dir, 'node_modules'), { recursive: true, dereference: false, force: true, errorOnExist: false, filter: (s) => !s.includes('.cache') });
writeFileSync(join(dir, 'package.json'), '{"type":"module"}');

const PORT = 4571;
const child = spawn(process.execPath, [join(dir, 'server.js')], {
  env: {
    ...process.env, TEST_PORT: String(PORT),
    VITE_SUPABASE_URL: SUPA_URL, VITE_SUPABASE_ANON_KEY: 'anon-key',
    ANTHROPIC_API_KEY: 'k', OPENAI_API_KEY: 'k', PERPLEXITY_API_KEY: 'k',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stderr.on('data', () => {});
// 서버가 뜰 때까지 대기
for (let i = 0; i < 60; i++) {
  try { await fetch(`http://127.0.0.1:${PORT}/api/claude/v1/messages`, { method: 'POST' }); break; }
  catch { await new Promise(r => setTimeout(r, 100)); }
}

async function call(path, headers) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 10, messages: [{ role: 'user', content: 'x' }] }),
  });
  let body = null; try { body = await res.json(); } catch { /* */ }
  return { status: res.status, body };
}

console.log('\n── A. server.js provider 정책 (D-007) ──');
{
  providerCalls.length = 0;
  const r = await call('/api/claude/v1/messages', {});
  ok('토큰 없으면 401', r.status === 401, `status=${r.status}`);
  ok('  → upstream 호출 0', providerCalls.length === 0);
}
{
  providerCalls.length = 0;
  const r = await call('/api/claude/v1/messages', { 'x-sb-auth': 'wrong', 'x-ws-id': WS_ALLOWED });
  ok('잘못된 토큰이면 401', r.status === 401, `status=${r.status}`);
  ok('  → upstream 호출 0', providerCalls.length === 0);
}
{
  providerCalls.length = 0;
  const r = await call('/api/claude/v1/messages', { 'x-sb-auth': TOKEN, 'x-ws-id': WS_BLOCKED });
  ok('★ 차단된 워크스페이스(시목)는 403', r.status === 403, `status=${r.status}`);
  ok('★ → 모델 upstream 호출 0건 (실제 spy)', providerCalls.length === 0, `호출 ${providerCalls.length}건`);
  ok('  → 에러 코드 provider_disabled', r.body?.error?.code === 'provider_disabled', JSON.stringify(r.body));
  ok('  → 사람이 읽을 이유 포함', /모델 실행이 꺼져/.test(r.body?.error?.message ?? ''));
}
{
  providerCalls.length = 0;
  const r = await call('/api/claude/v1/messages', { 'x-sb-auth': TOKEN, 'x-ws-id': WS_ALLOWED });
  ok('다른 브랜드(운명랩)는 통과 — 기존 기능 보존', r.status === 200, `status=${r.status}`);
  ok('  → upstream 호출 1건', providerCalls.length === 1);
  ok('  → x-ws-id 를 업스트림에 흘리지 않는다', !providerCalls[0]?.wsHeader, `받은 값=${providerCalls[0]?.wsHeader}`);
  ok('★ → 유저 Supabase 토큰이 외부로 새지 않는다', !providerCalls[0]?.sbAuthLeak, `받은 값=${providerCalls[0]?.sbAuthLeak}`);
  ok('  → 서버가 provider 키를 주입했다', providerCalls[0]?.auth === true);
}
{
  providerCalls.length = 0;
  const r = await call('/api/claude/v1/messages', { 'x-sb-auth': TOKEN, 'x-ws-id': WS_FOREIGN });
  ok('★ 멤버가 아닌 워크스페이스는 403 (RLS 0행)', r.status === 403, `status=${r.status}`);
  ok('  → upstream 호출 0', providerCalls.length === 0);
  ok('  → 존재 여부를 알려주지 않는다(workspace_forbidden)', r.body?.error?.code === 'workspace_forbidden', JSON.stringify(r.body));
}
{
  providerCalls.length = 0;
  const r = await call('/api/claude/v1/messages', { 'x-sb-auth': TOKEN, 'x-ws-id': 'not-a-uuid' });
  ok('UUID 아니면 거절', r.status === 403 && r.body?.error?.code === 'bad_workspace', `${r.status} ${JSON.stringify(r.body)}`);
  ok('  → upstream 호출 0', providerCalls.length === 0);
}
{
  providerCalls.length = 0;
  const r = await call('/api/claude/v1/messages', { 'x-sb-auth': TOKEN });
  ok('헤더 없으면 personal 정책으로 평가(개인 기능 보존)', r.status === 200, `status=${r.status}`);
  ok('  → upstream 호출 1건', providerCalls.length === 1);
}
{
  // openai / perplexity 경로도 같은 정책인지
  for (const p of ['/api/openai/v1/chat/completions', '/api/perplexity/chat/completions']) {
    providerCalls.length = 0;
    const r = await call(p, { 'x-sb-auth': TOKEN, 'x-ws-id': WS_BLOCKED });
    ok(`${p} 도 차단`, r.status === 403 && providerCalls.length === 0, `status=${r.status} calls=${providerCalls.length}`);
  }
}
{
  // 이미지 생성 경로(openai images)도 같은 미들웨어를 타는지
  providerCalls.length = 0;
  const r = await call('/api/openai/v1/images/generations', { 'x-sb-auth': TOKEN, 'x-ws-id': WS_BLOCKED });
  ok('★ 이미지 생성 경로도 차단', r.status === 403 && providerCalls.length === 0, `status=${r.status} calls=${providerCalls.length}`);
}

console.log('\n── B. fail-closed: 정책을 확인할 수 없으면 막는다 ──');
{
  // 가짜 Supabase REST 를 죽여 정책 조회를 실패시킨다
  supa.close();
  await new Promise(r => setTimeout(r, 100));
  providerCalls.length = 0;
  // 캐시 TTL(60s) 때문에 이미 평가된 조합은 통과할 수 있으니 새 workspace 로 시험
  const freshWs = '55555555-5555-4555-8555-555555555555';
  const r = await call('/api/claude/v1/messages', { 'x-sb-auth': TOKEN, 'x-ws-id': freshWs });
  ok('Supabase 불통 시 통과시키지 않는다', r.status >= 400, `status=${r.status}`);
  ok('  → upstream 호출 0', providerCalls.length === 0, `호출 ${providerCalls.length}건`);
}

child.kill();
upstream.close();

console.log(`\n${'='.repeat(60)}`);
console.log(`PASS ${pass} / FAIL ${fail}   (가짜 Supabase 조회 ${supaHits}회, 실제 provider 호출 0회)`);
if (fail) { console.log('\n실패 목록:'); failures.forEach(f => console.log('  - ' + f)); }
process.exit(fail ? 1 : 0);
