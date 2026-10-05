/**
 * @file scripts/bridge-test.mjs
 * @description bridge 왕복 런타임 검사 — BRIDGE-O1
 *
 * 왜: 15_LOCAL_DATA_BRIDGE.md §완료기준 은 **시연**을 요구한다.
 *   "폴더 이름만 만든 것을 동기화 완료로 표시하지 않는다."
 *   그래서 실제로 `bridge.mjs` 를 **자식 프로세스로 실행**하고, 가짜 Supabase 를 띄워
 *   pull → (GPT 가 outbox 작성) → push → receipt 재조회까지 돌린다.
 *
 * 범위: bridge 의 **로직**(파일 생성·manifest·멱등·충돌·경로 안전·원자적 교체)을 검증한다.
 *   실제 Office 계정 왕복은 대표가 `bridge login` 한 뒤에만 가능하다 — 그것은 NOT RUN 이다.
 *
 * 실행: node scripts/bridge-test.mjs
 */
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; failures.push(name + (detail ? ` — ${detail}` : '')); console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

const WS = 'aaaaaaaa-1111-4111-8111-111111111111';     // 시목 역할
const WS_OTHER = 'bbbbbbbb-2222-4222-8222-222222222222'; // 내가 멤버가 아닌 workspace
const REQ_ID = 'cccccccc-3333-4333-8333-333333333333';
const TOKEN = 'test-access-token';
const REFRESH = 'test-refresh-token';

// ── 가짜 Supabase (auth + PostgREST, RLS 흉내) ──
const db = {
  edit_requests: [{
    id: REQ_ID, workspace_id: WS, target_type: 'content_item', target_id: 'content-1',
    base_version: 'v3', title: '도마 릴스 훅 다시', body: '첫 문장을 질문형으로 바꿔주세요.',
    reason: '저장률이 낮아요', direct_edit_diff: null, status: 'open',
    read_at: null, read_by_run: null, created_at: '2026-10-05T09:00:00+09:00',
  }],
  daily_reports: [{ id: 'rep-1', workspace_id: WS, date: '2026-10-04', title: '어제 요약', summary: 's', body: '# 본문', trigger: 'manual', model: 'sonnet', status: 'done', created_at: '2026-10-04T09:00:00+09:00' }],
  content_items: [{ id: 'content-1', workspace_id: WS, title: '도마 릴스', status: 'scripted', created_at: '2026-10-01T00:00:00+09:00' }],
  tasks: [{ id: 't1', workspace_id: WS, title: '촬영', status: 'todo', created_at: '2026-10-01T00:00:00+09:00' }],
  company_memory: [], source_snapshots: [], web_analytics: [], work_documents: [],
  staff_output_actions: [], bridge_runs: [], bridge_outputs: [],
  workspaces: [{ id: WS, name: '시목', type: 'office', office_shell: 'simok', erp_source: 'simok_api' }],
};
let restCalls = 0;
let sawServiceRoleKey = false;

const srv = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const auth = req.headers.authorization || '';
  const body = await new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b)); });

  if (url.pathname === '/auth/v1/token') {
    const j = JSON.parse(body || '{}');
    if (j.refresh_token !== REFRESH) { res.writeHead(401).end('{}'); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ access_token: TOKEN, refresh_token: REFRESH, user: { id: 'user-1' } }));
    return;
  }

  if (url.pathname.startsWith('/rest/v1/')) {
    restCalls++;
    // ★ service_role 키를 쓰면 즉시 잡는다
    if (/service_role|sbp_/.test(auth)) sawServiceRoleKey = true;
    if (auth !== `Bearer ${TOKEN}`) { res.writeHead(401).end('[]'); return; }

    const table = url.pathname.replace('/rest/v1/', '');
    const rows = db[table] ?? [];
    const wsEq = url.searchParams.get('workspace_id');     // "eq.<uuid>"
    // RLS 흉내: 내가 멤버인 workspace 만
    const visible = rows.filter(r => !r.workspace_id || r.workspace_id === WS);

    if (req.method === 'GET') {
      let out = visible;
      if (wsEq) {
        const want = wsEq.replace(/^eq\./, '');
        out = want === WS ? visible : [];       // 다른 workspace → 0행
      }
      const idEq = url.searchParams.get('id');
      if (idEq) out = out.filter(r => r.id === idEq.replace(/^eq\./, ''));
      const runEq = url.searchParams.get('run_id');
      if (runEq) out = out.filter(r => r.run_id === decodeURIComponent(runEq.replace(/^eq\./, '')));
      const dirEq = url.searchParams.get('direction');
      if (dirEq) out = out.filter(r => r.direction === dirEq.replace(/^eq\./, ''));
      const keyEq = url.searchParams.get('item_key');
      if (keyEq) out = out.filter(r => r.item_key === decodeURIComponent(keyEq.replace(/^eq\./, '')));
      const statusIn = url.searchParams.get('status');
      if (statusIn?.startsWith('in.')) {
        const allowed = statusIn.slice(3).replace(/[()]/g, '').split(',');
        out = out.filter(r => allowed.includes(r.status));
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(out));
      return;
    }

    if (req.method === 'POST') {
      const row = JSON.parse(body);
      db[table] ??= [];
      // UNIQUE 흉내
      const dupe = table === 'bridge_outputs'
        ? db[table].find(r => r.workspace_id === row.workspace_id && r.run_id === row.run_id && r.item_key === row.item_key)
        : table === 'bridge_runs'
          ? db[table].find(r => r.workspace_id === row.workspace_id && r.run_id === row.run_id && r.direction === row.direction)
          : null;
      const prefer = req.headers.prefer || '';
      if (dupe) {
        if (prefer.includes('ignore-duplicates')) { res.writeHead(201).end(''); return; }
        if (prefer.includes('merge-duplicates')) { Object.assign(dupe, row); res.writeHead(201).end(''); return; }
        res.writeHead(409).end(JSON.stringify({ message: 'duplicate key' })); return;
      }
      db[table].push({ id: `${table}-${db[table].length + 1}`, created_at: new Date().toISOString(), ...row });
      res.writeHead(201).end('');
      return;
    }

    if (req.method === 'PATCH') {
      const patch = JSON.parse(body);
      const idEq = url.searchParams.get('id');
      const target = (db[table] ?? []).find(r => r.id === idEq?.replace(/^eq\./, ''));
      if (target) Object.assign(target, patch);
      res.writeHead(204).end('');
      return;
    }
  }
  res.writeHead(404).end('{}');
});
srv.listen(0);
await once(srv, 'listening');
const SUPA = `http://127.0.0.1:${srv.address().port}`;

// ── 임시 작업 공간 ──
const work = mkdtempSync(join(tmpdir(), 'bridge-'));
const ROOT = join(work, 'bridge');
const CONFIG = join(work, 'config.json');
mkdirSync(ROOT, { recursive: true });
writeFileSync(CONFIG, JSON.stringify({ supabaseUrl: SUPA, anonKey: 'anon-test', email: 'dev@example.com' }));

const env = { ...process.env, BRIDGE_CONFIG: CONFIG, BRIDGE_REFRESH_TOKEN: REFRESH };
/**
 * bridge 를 자식 프로세스로 실행한다.
 * ⚠️ execFileSync 를 쓰면 안 된다 — 부모의 이벤트 루프를 막아서 같은 프로세스의
 *    가짜 Supabase 서버가 자식의 요청에 응답하지 못하고 교착한다.
 */
function run(args) {
  return new Promise((resolve) => {
    const ch = spawn(process.execPath, ['scripts/bridge.mjs', ...args, '--root', ROOT], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    ch.stdout.on('data', d => out += d);
    ch.stderr.on('data', d => out += d);
    const timer = setTimeout(() => { ch.kill('SIGKILL'); resolve({ out: out + '\n[TIMEOUT]', code: 124 }); }, 20000);
    ch.on('close', (code) => { clearTimeout(timer); resolve({ out, code: code ?? 0 }); });
  });
}
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

console.log('\n── A. pull — Office 자료가 로컬 사본이 된다 ──');
const pull1 = await run(['pull', '--json']);
let cur;
{
  ok('pull 성공', pull1.code === 0, pull1.out.slice(0, 300));
  ok('current.json 생성', existsSync(join(ROOT, 'current.json')));
  cur = readJson('current.json');
  ok('snapshot_id 고정됨', !!cur.snapshot_id);
  ok('workspace 가 서버에서 온 값', cur.workspace_id === WS);

  const snapDir = join(ROOT, 'snapshots', cur.snapshot_id);
  ok('snapshot 폴더 생성', existsSync(snapDir));
  ok('index.md 있다 (GPT 가 먼저 읽는 파일)', existsSync(join(snapDir, 'index.md')));
  ok('manifest.json 있다', existsSync(join(snapDir, 'manifest.json')));
  ok('data/*.json 원문 있다', existsSync(join(snapDir, 'data', 'edit-requests.json')));

  // ★ 대표의 수정 요청이 빠지지 않아야 한다 (15 문서의 핵심)
  const reqMd = join(snapDir, 'records', 'edit-requests', `${REQ_ID}.md`);
  ok('★ 대표 수정 요청이 MD 로 내려왔다', existsSync(reqMd));
  if (existsSync(reqMd)) {
    const md = readFileSync(reqMd, 'utf8');
    ok('  요청 ID 가 들어 있다', md.includes(REQ_ID));
    ok('  이유가 들어 있다', md.includes('저장률이 낮아요'));
    ok('  기준 버전이 들어 있다', md.includes('v3'));
    ok('  "GPT 가 읽은 시각" 을 저장과 구별해 적는다', md.includes('아직 없음'));
  }

  const man = JSON.parse(readFileSync(join(snapDir, 'manifest.json'), 'utf8'));
  ok('manifest 에 파일별 sha256', man.files.length > 0 && man.files.every(f => /^[0-9a-f]{64}$/.test(f.sha256)));
  ok('manifest 에 제외 범위 기록', Array.isArray(man.excluded) && man.excluded.length > 0);
  ok('manifest 에 source_data_through (신선도)', 'source_data_through' in man);
  ok('manifest workspace 가 server-bound', man.workspace.id === WS);

  const idx = readFileSync(join(snapDir, 'index.md'), 'utf8');
  ok('★ 수신 0건이면 "숫자를 지어내지 마세요" 경고', idx.includes('지어내지 마세요'));
  ok('index 가 열린 요청을 먼저 읽게 안내', idx.includes('열린 수정 요청'));

  const runRow = db.bridge_runs.find(r => r.direction === 'pull');
  ok('Office 에 pull 기록이 남는다', !!runRow && runRow.status === 'succeeded');
}

console.log('\n── B. 보안 — service_role 을 쓰지 않는다 ──');
{
  ok('★ service_role/관리자 키를 한 번도 쓰지 않았다', sawServiceRoleKey === false);
  ok('모든 REST 호출이 사용자 토큰으로', restCalls > 0);
  const cfgRaw = readFileSync(CONFIG, 'utf8');
  ok('설정 파일에 refresh token 이 없다', !cfgRaw.includes(REFRESH));
  // 로컬 사본 어디에도 토큰이 없어야 한다
  const all = [];
  const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name); f.isDirectory() ? walk(p) : all.push(p); } };
  walk(ROOT);
  const leaked = all.filter(p => { try { return readFileSync(p, 'utf8').includes(TOKEN) || readFileSync(p, 'utf8').includes(REFRESH); } catch { return false; } });
  ok('★ 로컬 사본 어디에도 토큰이 새지 않는다', leaked.length === 0, leaked.join(', '));
}

console.log('\n── C. 다른 workspace 차단 ──');
{
  const r = await run(['pull', '--json', '--workspace', WS_OTHER]);
  ok('멤버가 아닌 workspace 는 거절', r.code !== 0 || /접근할 수 없습니다/.test(r.out), r.out.slice(0, 200));
}

console.log('\n── D. push — GPT 결과가 Office 로 ──');
const RUN_ID = 'run_test_0001';
{
  const obx = join(ROOT, 'outbox', RUN_ID);
  mkdirSync(obx, { recursive: true });
  writeFileSync(join(obx, 'answer.md'), '# 새 훅 3안\n\n요청 ' + REQ_ID + ' 에 대한 답입니다.');
  writeFileSync(join(obx, 'manifest.json'), JSON.stringify({
    run_id: RUN_ID,
    items: [{
      item_key: 'hook-rewrite', kind: 'content_draft', file: 'answer.md',
      answers_request_id: REQ_ID, base_version: 'v3',
      input_refs: { snapshot_id: cur.snapshot_id },
    }],
  }, null, 2));

  const p = await run(['push', '--json']);
  ok('push 성공', p.code === 0, p.out.slice(0, 300));
  ok('receipt 생성', existsSync(join(ROOT, 'receipts', `${RUN_ID}.json`)));
  const rc = readJson(`receipts/${RUN_ID}.json`);
  ok('receipt 에 저장 ID', !!rc.items[0]?.stored_id);
  ok('★ receipt 의 해시가 일치 (서버 재조회로 확인)', rc.items[0]?.hash_matches === true);
  ok('receipt status = stored', rc.items[0]?.status === 'stored');

  const outRow = db.bridge_outputs.find(r => r.item_key === 'hook-rewrite');
  ok('Office 에 결과가 저장됨', !!outRow);
  ok('  원문 그대로 보관', outRow?.raw_body_text?.includes('새 훅 3안'));
  ok('  input_refs 로 읽은 근거가 남는다', outRow?.input_refs?.snapshot_id === cur.snapshot_id);

  const req = db.edit_requests.find(r => r.id === REQ_ID);
  ok('★ 수정 요청이 answered 로 바뀐다', req?.status === 'answered');
  ok('  답변 참조가 연결된다', !!req?.answered_ref);
}

console.log('\n── E. 멱등 — 같은 run 재시도가 중복을 만들지 않는다 ──');
{
  const before = db.bridge_outputs.length;
  const p2 = await run(['push', '--json']);
  ok('재시도 성공', p2.code === 0);
  ok('★ 결과물이 늘지 않는다', db.bridge_outputs.length === before, `${before} → ${db.bridge_outputs.length}`);
  ok('이미 보냈다고 알린다', /이미 보냈/.test(p2.out) || p2.out.includes('already_pushed'));
}

console.log('\n── F. 충돌 — 기준 버전이 바뀐 원고를 덮어쓰지 않는다 ──');
{
  // Office 쪽 기준 버전이 v4 로 바뀐 상황
  db.edit_requests[0].base_version = 'v4';
  db.edit_requests[0].status = 'open';
  const RUN2 = 'run_test_0002';
  const obx = join(ROOT, 'outbox', RUN2);
  mkdirSync(obx, { recursive: true });
  writeFileSync(join(obx, 'a.md'), '# 옛 기준으로 쓴 원고');
  writeFileSync(join(obx, 'manifest.json'), JSON.stringify({
    run_id: RUN2,
    items: [{ item_key: 'stale', kind: 'content_draft', file: 'a.md', answers_request_id: REQ_ID, base_version: 'v3' }],
  }, null, 2));

  const p = await run(['push', '--json']);
  const rc = JSON.parse(readFileSync(join(ROOT, 'receipts', `${RUN2}.json`), 'utf8'));
  ok('★ 충돌로 표시된다', rc.items[0]?.status === 'conflicted', JSON.stringify(rc.items[0]));
  ok('  이유가 남는다', /기준 버전이 다릅니다/.test(rc.items[0]?.conflict ?? ''));
  ok('  요청이 conflicted 가 된다', db.edit_requests[0].status === 'conflicted');
  ok('  outbox 를 지우지 않는다', existsSync(join(obx, 'a.md')));
  ok('  receipt 가 덮어쓰지 않았음을 설명', /덮어쓰지 않았습니다/.test(rc.note));
  void p;
}

console.log('\n── G. 경로 안전 — 허용 루트 밖으로 못 쓴다 ──');
{
  const RUN3 = 'run_test_0003';
  const obx = join(ROOT, 'outbox', RUN3);
  mkdirSync(obx, { recursive: true });
  writeFileSync(join(obx, 'manifest.json'), JSON.stringify({
    run_id: RUN3,
    items: [{ item_key: 'escape', kind: 'answer', file: '../../../../etc/passwd' }],
  }, null, 2));
  const p = await run(['push', '--json']);
  const rc = JSON.parse(readFileSync(join(ROOT, 'receipts', `${RUN3}.json`), 'utf8'));
  ok('★ path traversal 이 막힌다', rc.items[0]?.status === 'failed' && /허용 루트 밖/.test(rc.items[0]?.error ?? ''), JSON.stringify(rc.items[0]));
  void p;
}

console.log('\n── H. status — 저장과 "실제 읽음" 을 구별한다 ──');
{
  const s = await run(['status', '--json']);
  ok('status 성공', s.code === 0, s.out.slice(0, 200));
  const j = JSON.parse(s.out);
  ok('열린 요청 수를 보여준다', typeof j.open_edit_requests === 'number');
  ok('★ "GPT 가 실제 읽은 것" 을 따로 센다', typeof j.read_by_gpt === 'number');
  ok('마지막 pull/push 시각', !!j.last_pull?.at && !!j.last_push?.at);
  ok('최신 원천 snapshot 상태를 보여준다', 'latest_source_snapshot' in j);
}

console.log('\n── I. 원자적 교체 — 절반짜리 snapshot 을 읽지 않는다 ──');
{
  const before = readJson('current.json').snapshot_id;
  await run(['pull', '--json']);
  const after = readJson('current.json').snapshot_id;
  ok('새 pull 이 current 를 바꾼다', after !== before);
  ok('이전 snapshot 폴더도 남아 있다', existsSync(join(ROOT, 'snapshots', before)));
  const tmps = readdirSync(ROOT).filter(f => f.startsWith('.tmp-') || f.startsWith('.current-'));
  ok('★ 임시 파일이 남지 않는다', tmps.length === 0, tmps.join(', '));
}

srv.close();
rmSync(work, { recursive: true, force: true });

console.log(`\n${'='.repeat(60)}`);
console.log(`PASS ${pass} / FAIL ${fail}   (가짜 Supabase REST 호출 ${restCalls}회 · service_role 사용 ${sawServiceRoleKey ? '있음' : '없음'})`);
if (fail) { console.log('\n실패 목록:'); failures.forEach(f => console.log('  - ' + f)); }
process.exit(fail ? 1 : 0);
