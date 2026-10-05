#!/usr/bin/env node
/**
 * @file scripts/bridge.mjs
 * @description Office Supabase ↔ 로컬 업무 사본 ↔ GPT 동기화 — BRIDGE-O1
 *
 * 기준: 공유 폴더 `15_LOCAL_DATA_BRIDGE.md`
 *
 *   시목 Supabase → Office Supabase → **이 명령** → 로컬 MD/JSON/이미지
 *                                       → GPT 읽기·작업 → outbox
 *                                       → **이 명령** → Office 저장 → receipt
 *
 * ★ 설계 원칙 (15 문서)
 *  - Office 에 저장된 자료를 기준으로 로컬 사본을 만든다. 대표의 수정 요청·결정·사진 지시가 빠지지 않는다.
 *  - **service_role 키를 쓰지 않는다.** 대표 계정으로 로그인해 RLS 가 그대로 적용된다.
 *    ("실제 인증·RLS 를 확인하지 않고 임의 관리자 키 연결을 선택하지 않는다")
 *  - 자격증명은 공유 폴더 밖 **macOS Keychain** 에 둔다. MD·프론트·git 에 넣지 않는다.
 *  - 파일 묶음을 임시 위치에 쓰고 검증한 뒤 `current.json` 을 **원자적으로 교체**한다.
 *    GPT 는 읽기 시작할 때 snapshot_id 를 고정한다 → 절반짜리 파일을 읽지 않는다.
 *  - 같은 run 재시도는 **멱등**. 중복 보고서·콘텐츠를 만들지 않는다.
 *  - 기준 버전이 바뀐 대표 원고를 덮어쓰지 않는다. 충돌은 따로 표시한다.
 *  - 저장만 한 것과 **GPT 가 실제 읽은 것**을 구별해 기록한다.
 *
 * ⚠️ 모델 API 를 호출하지 않는다(D-007). 일반 데이터 코드다.
 *
 * 사용법:
 *   node scripts/bridge.mjs login      # 1회. 이메일·비밀번호를 받아 refresh token 을 Keychain 에 저장
 *   node scripts/bridge.mjs status     # 연결·마지막 동기화·열린 요청 수
 *   node scripts/bridge.mjs pull       # Office → 로컬 (GPT 작업 **시작 직전**)
 *   node scripts/bridge.mjs push       # 로컬 outbox → Office (GPT 작업 **끝날 때**)
 *   node scripts/bridge.mjs logout
 *
 *   옵션: --workspace <uuid>  --root <경로>  --json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

// ─────────────────────────── 설정 ───────────────────────────

const DEFAULT_ROOT = '/Users/solmac/.codex/.chatgpt-projects/g-p-6a5f60f490f08191a6af058b45a467c3/deliverables/simok-ai-office-v1/operations/bridge';
const KEYCHAIN_SERVICE = 'sol-ai-office-bridge';
/**
 * 설정 위치. 기본은 홈 디렉터리(공유 폴더 밖).
 * `BRIDGE_CONFIG` 로 덮어쓸 수 있다 — **자동 시험 전용**이다.
 * 운영에서는 설정하지 않는다.
 */
const CONFIG_PATH = process.env.BRIDGE_CONFIG || join(process.env.HOME || '', '.sol-ai-office-bridge.json');
/**
 * refresh token 은 macOS Keychain 이 기본이다.
 * `BRIDGE_REFRESH_TOKEN` 은 **자동 시험 전용** 우회로다(가짜 Supabase 에만 붙인다).
 * 운영에서 이 값을 쓰면 토큰이 프로세스 환경에 남으므로 쓰지 않는다.
 */
const TEST_REFRESH_TOKEN = process.env.BRIDGE_REFRESH_TOKEN || null;

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
};
const has = (name) => argv.includes(`--${name}`);
const AS_JSON = has('json');

const BRIDGE_ROOT = resolve(flag('root', DEFAULT_ROOT));

function log(...a) { if (!AS_JSON) console.log(...a); }
function die(msg, code = 1) {
  if (AS_JSON) console.log(JSON.stringify({ ok: false, error: msg }));
  else console.error(`\n✗ ${msg}\n`);
  process.exit(code);
}

// ─────────────────────── 자격증명 (Keychain) ───────────────────────
// 공유 폴더·git·MD 어디에도 값을 쓰지 않는다. macOS Keychain 만 쓴다.

function keychainSet(account, value) {
  execFileSync('security', [
    'add-generic-password', '-U', '-s', KEYCHAIN_SERVICE, '-a', account, '-w', value,
  ], { stdio: 'pipe' });
}
function keychainGet(account) {
  try {
    return execFileSync('security', [
      'find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', account, '-w',
    ], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch { return null; }
}
function keychainDel(account) {
  try { execFileSync('security', ['delete-generic-password', '-s', KEYCHAIN_SERVICE, '-a', account], { stdio: 'ignore' }); }
  catch { /* 없으면 무시 */ }
}

/** Supabase URL/anon 키는 비밀이 아니다(프론트 번들에 들어간다). 설정 파일에 둔다. */
function readConfig() {
  if (!existsSync(CONFIG_PATH)) return null;
  try { return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')); } catch { return null; }
}
function writeConfig(cfg) {
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
}

// ─────────────────────────── Supabase ───────────────────────────

async function refreshAccessToken(cfg, refreshToken) {
  const r = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: cfg.anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!r.ok) return null;
  return r.json();
}

async function connect() {
  const cfg = readConfig();
  if (!cfg?.supabaseUrl || !cfg?.anonKey) {
    die('먼저 로그인해 주세요:  node scripts/bridge.mjs login');
  }
  const refreshToken = TEST_REFRESH_TOKEN || keychainGet('refresh_token');
  if (!refreshToken) die('저장된 자격증명이 없어요. 다시 로그인해 주세요:  node scripts/bridge.mjs login');

  const sess = await refreshAccessToken(cfg, refreshToken);
  if (!sess?.access_token) {
    die('자격증명이 만료되었어요. 다시 로그인해 주세요:  node scripts/bridge.mjs login');
  }
  // 회전된 refresh token 을 갱신 저장
  if (!TEST_REFRESH_TOKEN && sess.refresh_token && sess.refresh_token !== refreshToken) {
    keychainSet('refresh_token', sess.refresh_token);
  }

  const headers = {
    apikey: cfg.anonKey,
    Authorization: `Bearer ${sess.access_token}`,
    'content-type': 'application/json',
  };
  /** PostgREST — **RLS 가 그대로 적용된다**(service_role 아님) */
  const rest = async (path, init = {}) => {
    const r = await fetch(`${cfg.supabaseUrl}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
    const text = await r.text();
    if (!r.ok) {
      // 토큰·본문을 그대로 찍지 않는다
      throw new Error(`Supabase ${r.status} (${path.split('?')[0]}): ${text.slice(0, 300)}`);
    }
    return text ? JSON.parse(text) : null;
  };
  return { cfg, rest, userId: sess.user?.id ?? null };
}

// ─────────────────────── 경로 안전 ───────────────────────
// 15 문서: "원격 경로는 허용 루트 안으로 제한하며 path traversal/symlink 로 밖에 쓰지 않게 검증한다"

function safeJoin(root, ...parts) {
  const p = resolve(root, ...parts);
  const rel = relative(root, p);
  if (rel.startsWith('..') || rel.startsWith(sep) || resolve(root, rel) !== p) {
    throw new Error(`허용 루트 밖 경로입니다: ${parts.join('/')}`);
  }
  return p;
}
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
/** 파일명으로 쓸 수 있게 — 경로 구분자·상위 이동을 제거 */
const slug = (s) => String(s).replace(/[^\w가-힣.-]+/g, '-').replace(/^[.-]+/, '').slice(0, 80) || 'item';

function writeFileIn(root, relPath, content) {
  const p = safeJoin(root, relPath);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, content);
  return { path: relPath, bytes: Buffer.byteLength(content), sha256: sha256(content) };
}

// ─────────────────────────── login ───────────────────────────

async function cmdLogin() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log('\nOffice(Supabase) 로그인 — 값은 macOS Keychain 에만 저장됩니다.');
  console.log('공유 폴더·git·MD 에는 쓰지 않습니다.\n');

  const existing = readConfig();
  const supabaseUrl = (await rl.question(`Supabase URL${existing?.supabaseUrl ? ` [${existing.supabaseUrl}]` : ''}: `)).trim() || existing?.supabaseUrl;
  const anonKey = (await rl.question('anon key (공개 키 — 프론트 번들에 들어가는 값): ')).trim() || existing?.anonKey;
  const email = (await rl.question('이메일: ')).trim();

  // 비밀번호는 에코하지 않는다
  process.stdout.write('비밀번호: ');
  const password = await new Promise((res) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode?.(true); stdin.resume();
    let buf = '';
    const onData = (ch) => {
      const s = ch.toString('utf8');
      if (s === '\n' || s === '\r' || s === '\u0004') {
        stdin.setRawMode?.(wasRaw); stdin.removeListener('data', onData);
        process.stdout.write('\n'); res(buf);
      } else if (s === '\u0003') { process.stdout.write('\n'); process.exit(130); }
      else if (s === '\u007f') { buf = buf.slice(0, -1); }
      else buf += s;
    };
    stdin.on('data', onData);
  });
  rl.close();

  if (!supabaseUrl || !anonKey || !email || !password) die('입력이 비었습니다.');

  const r = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) die(`로그인 실패 (${r.status}). 이메일·비밀번호·URL 을 확인해 주세요.`);
  const sess = await r.json();
  if (!sess.refresh_token) die('refresh token 을 받지 못했습니다.');

  keychainSet('refresh_token', sess.refresh_token);
  writeConfig({ supabaseUrl, anonKey, email, savedAt: new Date().toISOString() });

  console.log(`\n✓ 저장했습니다.`);
  console.log(`  자격증명 : macOS Keychain (서비스 "${KEYCHAIN_SERVICE}")`);
  console.log(`  설정     : ${CONFIG_PATH}  (URL·anon 키만 · 0600)`);
  console.log(`\n다음: node scripts/bridge.mjs status\n`);
}

function cmdLogout() {
  keychainDel('refresh_token');
  try { rmSync(CONFIG_PATH); } catch { /* noop */ }
  log('\n✓ 자격증명을 지웠습니다.\n');
}

// ─────────────────────── workspace 고르기 ───────────────────────

async function resolveWorkspace(rest) {
  const want = flag('workspace');
  // RLS 덕분에 **내가 멤버인 것만** 돌아온다
  const rows = await rest('workspaces?select=id,name,type,office_shell,erp_source&order=created_at');
  if (!rows?.length) die('접근 가능한 워크스페이스가 없습니다.');
  if (want) {
    const w = rows.find(x => x.id === want);
    if (!w) die(`그 워크스페이스에 접근할 수 없습니다 (멤버가 아니거나 없는 id).`);
    return w;
  }
  const cfg = readConfig();
  if (cfg?.workspaceId) {
    const w = rows.find(x => x.id === cfg.workspaceId);
    if (w) return w;
  }
  // 전용 셸이 붙은 오피스를 기본으로
  const simok = rows.find(x => x.office_shell === 'simok');
  if (simok) return simok;
  const office = rows.find(x => x.type === 'office');
  if (office) return office;
  die('오피스 워크스페이스가 없습니다. --workspace <uuid> 로 지정해 주세요.');
}

// ─────────────────────────── pull ───────────────────────────

async function cmdPull() {
  const { rest, userId } = await connect();
  const ws = await resolveWorkspace(rest);
  const runId = `pull_${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}_${randomUUID().slice(0, 8)}`;
  const exportedAt = new Date().toISOString();

  log(`\n■ pull — ${ws.name}`);
  log(`  run: ${runId}`);

  // ── Office 에서 읽는다. 각 쿼리는 workspace 로 좁히고 RLS 가 다시 한 번 막는다 ──
  const q = (t, extra = '') => rest(`${t}?workspace_id=eq.${ws.id}&${extra}`);
  const [editRequests, reports, contents, tasks, memories, snapshots, webAnalytics, docs, actions] = await Promise.all([
    q('edit_requests', 'select=*&order=created_at.desc&limit=200').catch(() => []),
    q('daily_reports', 'select=id,date,title,summary,body,trigger,model,status,output_kind,created_at&order=created_at.desc&limit=60'),
    q('content_items', 'select=*&order=created_at.desc&limit=200'),
    q('tasks', 'select=id,title,status,priority,due_date,category,notes,source,assignee_id,created_at&order=created_at.desc&limit=300'),
    q('company_memory', 'select=*&order=created_at.desc&limit=200'),
    q('source_snapshots', 'select=id,business_date,revision,source_system,environment,usage,schema_version,raw_sha256,content_digest,generated_at,source_updated_at,received_at,quality&order=business_date.desc&limit=60').catch(() => []),
    q('web_analytics', 'select=id,period_start,period_end,revision,freshness,observed_at,source_data_through,ga_metrics,order_metrics,attribution,limitations&order=period_end.desc&limit=30').catch(() => []),
    q('work_documents', 'select=*&order=created_at.desc&limit=200').catch(() => []),
    q('staff_output_actions', 'select=id,report_id,type,status,payload,approved_at,created_at&order=created_at.desc&limit=200').catch(() => []),
  ]);

  // ── 임시 폴더에 전부 쓰고, 검증 뒤 원자적으로 교체 ──
  const snapshotId = runId;
  const tmp = safeJoin(BRIDGE_ROOT, `.tmp-${snapshotId}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const files = [];
  const put = (rel, content) => files.push(writeFileIn(tmp, rel, content));

  // ① 구조화 원문 (JSON)
  put('data/edit-requests.json', JSON.stringify(editRequests, null, 2));
  put('data/reports.json', JSON.stringify(reports, null, 2));
  put('data/content-items.json', JSON.stringify(contents, null, 2));
  put('data/tasks.json', JSON.stringify(tasks, null, 2));
  put('data/company-memory.json', JSON.stringify(memories, null, 2));
  put('data/source-snapshots.json', JSON.stringify(snapshots, null, 2));
  put('data/web-analytics.json', JSON.stringify(webAnalytics, null, 2));
  put('data/work-documents.json', JSON.stringify(docs, null, 2));
  put('data/staff-output-actions.json', JSON.stringify(actions, null, 2));

  // ② 사람이 읽을 기록 (MD) — 같은 자료에서 생성하므로 JSON 과 내용이 다르지 않다
  const openReqs = editRequests.filter(r => r.status === 'open' || r.status === 'read');
  for (const r of openReqs) {
    put(`records/edit-requests/${slug(r.id)}.md`, [
      `# 수정 요청: ${r.title}`, '',
      `- 요청 ID: \`${r.id}\``,
      `- 대상: ${r.target_type} \`${r.target_id}\``,
      `- 기준 버전: ${r.base_version ?? '(없음)'}`,
      `- 상태: ${r.status}`,
      `- 등록: ${r.created_at}`,
      r.read_at ? `- GPT 가 읽은 시각: ${r.read_at} (run ${r.read_by_run ?? '-'})` : '- GPT 가 읽은 시각: (아직 없음)',
      '', '## 요청 내용', '', r.body || '(없음)',
      '', '## 이유', '', r.reason || '(없음)',
      ...(r.direct_edit_diff ? ['', '## 대표가 직접 고친 부분', '', '```diff', r.direct_edit_diff, '```'] : []),
      '', '---', '',
      '> 이 요청에 답할 때는 **요청 ID 를 인용**하고, outbox 항목의',
      '> `answers_request_id` 에 위 ID 를 넣어 주세요. 기준 버전이 바뀌었으면 덮어쓰지 말고',
      '> `conflict` 로 표시해 주세요.',
    ].join('\n'));
  }
  for (const r of reports.slice(0, 20)) {
    put(`records/reports/${r.date}-${slug(r.id).slice(0, 12)}.md`, [
      `# ${r.title}`, '',
      `- 보고서 ID: \`${r.id}\``,
      `- 업무 날짜: ${r.date}`,
      `- 실행 계기: ${r.trigger === 'manual' ? '사람이 실행' : '예약 실행'}`,
      `- 생성 모델: ${r.model ?? '(기록 없음)'}`,
      `- 상태: ${r.status ?? 'done'}`,
      '', r.summary ? `> ${r.summary}` : '', '', r.body || '',
    ].join('\n'));
  }
  for (const d of docs.slice(0, 50)) {
    put(`records/documents/${slug(d.title)}-${slug(d.id).slice(0, 8)}.md`, [
      `# ${d.title}`, '',
      `- 문서 ID: \`${d.id}\``,
      `- 종류: ${d.kind}${d.is_proposal ? ' (미확정 제안)' : ''}`,
      d.supersedes_id ? `- 대체: \`${d.supersedes_id}\`` : '',
      `- 등록: ${d.created_at}`,
      '', d.body_md,
    ].filter(Boolean).join('\n'));
  }

  // ③ 인덱스 — GPT 가 먼저 읽는 파일
  const openTasks = tasks.filter(t => t.status !== 'done');
  put('index.md', [
    `# 시목 업무 사본 — ${ws.name}`, '',
    `- snapshot: \`${snapshotId}\``,
    `- 내보낸 시각: ${exportedAt}`,
    `- 기준: **Office Supabase 에 저장된 자료** (로컬에서 따로 만든 것이 아닙니다)`,
    '',
    '## 먼저 읽을 것', '',
    `1. **열린 수정 요청 ${openReqs.length}건** → \`records/edit-requests/\``,
    `2. 최근 보고서 ${Math.min(reports.length, 20)}건 → \`records/reports/\``,
    `3. 업무 문서 ${Math.min(docs.length, 50)}건 → \`records/documents/\``,
    '',
    '## 지금 상태', '',
    `| 종류 | 건수 |`, `|---|---|`,
    `| 열린 수정 요청 | ${openReqs.length} |`,
    `| 미완료 할일 | ${openTasks.length} |`,
    `| 콘텐츠 | ${contents.length} |`,
    `| 보고서 | ${reports.length} |`,
    `| 회사 기억 | ${memories.length} |`,
    `| 수신된 매출 snapshot | ${snapshots.length} |`,
    `| 방문·유입 집계 | ${webAnalytics.length} |`,
    '',
    snapshots.length === 0
      ? '> ⚠️ **수신된 매출 snapshot 이 0건입니다.** 실적 숫자를 지어내지 마세요.'
      : `> 최신 업무 날짜: ${snapshots[0].business_date} (r${snapshots[0].revision})`,
    webAnalytics.length === 0
      ? '> ⚠️ **방문·유입 집계가 0건입니다.** 방문자 수를 추정하지 마세요.' : '',
    '',
    '## 결과를 돌려주는 법', '',
    '```text',
    `outbox/<run_id>/manifest.json   # items[] = {item_key, kind, file, answers_request_id?, input_refs?}`,
    `outbox/<run_id>/<파일>.md`,
    '```',
    '그 뒤 `node scripts/bridge.mjs push` 를 실행하면 Office 에 저장되고 receipt 가 남습니다.',
    '',
    '## 규칙', '',
    '- 이 사본은 **읽기용**입니다. 여기 파일을 고쳐도 Office 에 반영되지 않습니다. outbox 로 보내세요.',
    '- 요약이 원문을 대체하지 않습니다. 필요하면 `data/*.json` 의 원문을 읽으세요.',
    '- 수정 요청에 답할 때는 **요청 ID 를 인용**하세요.',
  ].filter(Boolean).join('\n'));

  // ④ manifest — 범위·누락·해시
  const manifest = {
    snapshot_id: snapshotId,
    run_id: runId,
    workspace: { id: ws.id, name: ws.name },   // server-bound: RLS 를 통과한 workspace
    exported_at: exportedAt,
    exported_by: userId,
    source: 'office-supabase',
    /** 원천 자료가 어디까지인지 — 동기화 성공과 자료 신선도는 다르다(15 문서) */
    source_data_through: snapshots[0]?.received_at ?? null,
    latest_business_date: snapshots[0]?.business_date ?? null,
    source_revisions: snapshots.slice(0, 10).map(s => ({
      business_date: s.business_date, revision: s.revision,
      raw_sha256: s.raw_sha256, content_digest: s.content_digest,
    })),
    counts: {
      edit_requests_open: openReqs.length, edit_requests_total: editRequests.length,
      reports: reports.length, content_items: contents.length, tasks_open: openTasks.length,
      company_memory: memories.length, source_snapshots: snapshots.length,
      web_analytics: webAnalytics.length, work_documents: docs.length,
    },
    /** 범위에서 **제외한 것** — 빠뜨린 게 아니라 일부러 뺐다는 기록 */
    excluded: [
      '다른 브랜드 workspace (RLS + workspace 필터)',
      '고객 연락처·개인정보',
      '비밀키·토큰',
      'auth.users 원문',
    ],
    limits: '각 테이블 상한을 두고 최신순으로 가져온다. 상한에 닿으면 전체가 아니다.',
    files,
  };
  put('manifest.json', JSON.stringify(manifest, null, 2));
  const manifestSha = sha256(JSON.stringify(manifest));

  // ── 검증 후 원자적 교체 ──
  const finalDir = safeJoin(BRIDGE_ROOT, 'snapshots', snapshotId);
  mkdirSync(join(finalDir, '..'), { recursive: true });
  rmSync(finalDir, { recursive: true, force: true });
  renameSync(tmp, finalDir);

  // current.json 은 마지막에, 임시파일 → rename 으로 원자적 교체
  const current = {
    snapshot_id: snapshotId,
    path: relative(BRIDGE_ROOT, finalDir),
    exported_at: exportedAt,
    workspace_id: ws.id,
    workspace_name: ws.name,
    manifest_sha256: manifestSha,
    open_edit_requests: openReqs.length,
  };
  const curTmp = safeJoin(BRIDGE_ROOT, `.current-${randomUUID().slice(0, 8)}.json`);
  writeFileSync(curTmp, JSON.stringify(current, null, 2) + '\n');
  renameSync(curTmp, safeJoin(BRIDGE_ROOT, 'current.json'));

  // ── Office 에 pull 기록 ──
  let runRecorded = false;
  try {
    await rest('bridge_runs', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        workspace_id: ws.id, run_id: runId, direction: 'pull', status: 'succeeded',
        snapshot_id: snapshotId, completed_at: exportedAt,
        manifest_sha256: manifestSha, counts: manifest.counts, created_by: userId,
      }),
    });
    runRecorded = true;
  } catch (e) {
    log(`  ! Office 에 pull 기록 실패(로컬 사본은 정상): ${e.message.slice(0, 120)}`);
  }

  writeSyncStatus({ last_pull: { run_id: runId, at: exportedAt, snapshot_id: snapshotId, recorded_in_office: runRecorded } });

  if (AS_JSON) { console.log(JSON.stringify({ ok: true, ...current, recorded_in_office: runRecorded })); return; }
  log(`\n  ✓ ${files.length}개 파일`);
  log(`  → ${finalDir}`);
  log(`\n  열린 수정 요청 ${openReqs.length}건 · 미완료 할일 ${openTasks.length}건`);
  log(`  매출 snapshot ${snapshots.length}건 · 방문 집계 ${webAnalytics.length}건`);
  if (snapshots.length === 0) log(`  ⚠️ 매출 snapshot 0건 — 실적 숫자를 만들어내면 안 됩니다`);
  log(`\n  GPT 에게: ${join(relative(process.cwd(), finalDir), 'index.md')} 부터 읽게 하세요\n`);
}

// ─────────────────────────── push ───────────────────────────

async function cmdPush() {
  const { rest, userId } = await connect();
  const ws = await resolveWorkspace(rest);
  const outboxRoot = safeJoin(BRIDGE_ROOT, 'outbox');
  if (!existsSync(outboxRoot)) die(`outbox 가 없습니다: ${outboxRoot}`);

  const runs = readdirSync(outboxRoot).filter(d => {
    try { return statSync(join(outboxRoot, d)).isDirectory(); } catch { return false; }
  });
  if (!runs.length) die('보낼 outbox run 이 없습니다.');

  const results = [];
  for (const runId of runs) {
    const dir = safeJoin(outboxRoot, runId);
    const manPath = join(dir, 'manifest.json');
    if (!existsSync(manPath)) { log(`  - ${runId}: manifest.json 없음 — 건너뜀`); continue; }

    // 이미 보낸 run 인가 (멱등)
    const already = await rest(`bridge_runs?workspace_id=eq.${ws.id}&run_id=eq.${encodeURIComponent(runId)}&direction=eq.push&select=status,completed_at`).catch(() => []);
    if (already?.length && already[0].status === 'succeeded') {
      log(`  - ${runId}: 이미 보냈습니다 (${already[0].completed_at}) — 건너뜀`);
      results.push({ run_id: runId, status: 'already_pushed' });
      continue;
    }

    let man;
    try { man = JSON.parse(readFileSync(manPath, 'utf8')); }
    catch (e) { log(`  ! ${runId}: manifest 를 읽을 수 없습니다 — ${e.message}`); continue; }
    const items = Array.isArray(man.items) ? man.items : [];
    if (!items.length) { log(`  - ${runId}: items 가 비어 있음 — 건너뜀`); continue; }

    log(`\n■ push — ${runId} (${items.length}건)`);
    const stored = [];
    let failed = 0;

    for (const it of items) {
      const itemKey = String(it.item_key || it.file || randomUUID());
      try {
        if (!it.file) throw new Error('item.file 이 없습니다');
        const body = readFileSync(safeJoin(dir, it.file), 'utf8');
        const bodySha = sha256(body);

        // ── 충돌 검사: 기준 버전이 바뀐 대표 원고를 덮어쓰지 않는다 ──
        let conflict = null;
        if (it.answers_request_id) {
          const [req] = await rest(`edit_requests?id=eq.${it.answers_request_id}&select=id,status,base_version,target_type,target_id`) ?? [];
          if (!req) conflict = '요청 ID 를 찾을 수 없습니다';
          else if (req.status === 'applied') conflict = '이미 적용된 요청입니다';
          else if (it.base_version && req.base_version && it.base_version !== req.base_version) {
            conflict = `기준 버전이 다릅니다 (outbox ${it.base_version} ≠ Office ${req.base_version})`;
          }
        }

        const row = {
          workspace_id: ws.id, run_id: runId, item_key: itemKey,
          kind: it.kind || 'answer',
          body_sha256: bodySha, raw_body_text: body,
          answers_request_id: it.answers_request_id ?? null,
          input_refs: it.input_refs ?? null,
          status: conflict ? 'conflicted' : 'stored',
          note: conflict,
          created_by: userId,
        };

        // ★ 멱등: (workspace, run_id, item_key) UNIQUE. 같은 run 재시도는 중복을 만들지 않는다.
        await rest('bridge_outputs', {
          method: 'POST',
          headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify(row),
        });

        // 저장 결과를 **서버에서 다시 읽어** 확인한다 (receipt 근거)
        const [back] = await rest(`bridge_outputs?workspace_id=eq.${ws.id}&run_id=eq.${encodeURIComponent(runId)}&item_key=eq.${encodeURIComponent(itemKey)}&select=id,status,body_sha256,created_at`) ?? [];
        if (!back) throw new Error('저장 후 재조회에 실패했습니다');

        const hashMatches = back.body_sha256 === bodySha;
        stored.push({
          item_key: itemKey, kind: row.kind, stored_id: back.id, status: back.status,
          body_sha256: back.body_sha256, hash_matches: hashMatches, stored_at: back.created_at,
          conflict,
        });
        log(`  ${conflict ? '⚠' : '✓'} ${itemKey}${conflict ? ` — 충돌: ${conflict}` : ''}`);

        // 충돌이 아니면 요청 상태를 answered 로 (덮어쓰기는 하지 않는다)
        if (!conflict && it.answers_request_id) {
          await rest(`edit_requests?id=eq.${it.answers_request_id}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ status: 'answered', answered_at: new Date().toISOString(), answered_ref: back.id, updated_at: new Date().toISOString() }),
          }).catch(() => {});
        } else if (conflict && it.answers_request_id) {
          await rest(`edit_requests?id=eq.${it.answers_request_id}`, {
            method: 'PATCH', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ status: 'conflicted', conflict_note: conflict, updated_at: new Date().toISOString() }),
          }).catch(() => {});
        }
      } catch (e) {
        failed++;
        log(`  ✗ ${itemKey} — ${e.message.slice(0, 160)}`);
        stored.push({ item_key: itemKey, status: 'failed', error: e.message.slice(0, 300) });
      }
    }

    const okCount = stored.filter(s => s.status === 'stored').length;
    const conflicted = stored.filter(s => s.status === 'conflicted').length;
    const runStatus = failed > 0 ? 'failed' : conflicted > 0 ? 'conflicted' : 'succeeded';
    const completedAt = new Date().toISOString();

    await rest('bridge_runs', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        workspace_id: ws.id, run_id: runId, direction: 'push', status: runStatus,
        completed_at: completedAt, counts: { items: items.length, stored: okCount, conflicted, failed },
        created_by: userId,
      }),
    }).catch(() => {});

    // ── receipt ──
    const receipt = {
      run_id: runId, direction: 'push', status: runStatus,
      workspace: { id: ws.id, name: ws.name },
      pushed_at: completedAt,
      items: stored,
      note: failed > 0
        ? '실패한 항목이 있어 outbox 를 지우지 않았습니다. 고친 뒤 같은 run 으로 다시 실행하면 멱등하게 처리됩니다.'
        : conflicted > 0
          ? '충돌 항목이 있습니다. 기준 버전이 바뀐 원고를 덮어쓰지 않았습니다.'
          : '모든 항목이 저장되고 서버 재조회로 확인되었습니다.',
    };
    writeFileIn(BRIDGE_ROOT, `receipts/${slug(runId)}.json`, JSON.stringify(receipt, null, 2));
    log(`  → receipt: receipts/${slug(runId)}.json  (저장 ${okCount} · 충돌 ${conflicted} · 실패 ${failed})`);
    results.push({ run_id: runId, status: runStatus, stored: okCount, conflicted, failed });
  }

  writeSyncStatus({ last_push: { at: new Date().toISOString(), runs: results } });
  if (AS_JSON) console.log(JSON.stringify({ ok: true, results }));
  else log('');
}

// ─────────────────────────── status ───────────────────────────

async function cmdStatus() {
  const cfg = readConfig();
  if (!cfg) die('로그인 전입니다:  node scripts/bridge.mjs login');

  const { rest } = await connect();
  const ws = await resolveWorkspace(rest);
  const cur = readJsonIn('current.json');
  const sync = readJsonIn('sync-status.json');

  const [openReqs, lastRuns, snaps] = await Promise.all([
    rest(`edit_requests?workspace_id=eq.${ws.id}&status=in.(open,read)&select=id,title,status,read_at,created_at&order=created_at.desc`).catch(() => []),
    rest(`bridge_runs?workspace_id=eq.${ws.id}&select=run_id,direction,status,completed_at&order=created_at.desc&limit=6`).catch(() => []),
    rest(`source_snapshots?workspace_id=eq.${ws.id}&select=business_date,revision,received_at&order=business_date.desc&limit=1`).catch(() => []),
  ]);

  const out = {
    workspace: { id: ws.id, name: ws.name },
    local_snapshot: cur ? { snapshot_id: cur.snapshot_id, exported_at: cur.exported_at } : null,
    last_pull: sync?.last_pull ?? null,
    last_push: sync?.last_push ?? null,
    open_edit_requests: openReqs.length,
    read_by_gpt: openReqs.filter(r => r.read_at).length,
    latest_source_snapshot: snaps?.[0] ?? null,
    recent_runs: lastRuns,
  };
  if (AS_JSON) { console.log(JSON.stringify(out, null, 2)); return; }

  log(`\n■ bridge 상태 — ${ws.name}`);
  log(`  계정    : ${cfg.email}`);
  log(`  로컬 루트: ${BRIDGE_ROOT}`);
  log('');
  log(`  마지막 pull : ${sync?.last_pull?.at ?? '(없음)'}`);
  log(`  마지막 push : ${sync?.last_push?.at ?? '(없음)'}`);
  log(`  로컬 snapshot: ${cur?.snapshot_id ?? '(없음)'}`);
  log('');
  log(`  열린 수정 요청 : ${openReqs.length}건  (그중 GPT 가 실제 읽은 것 ${out.read_by_gpt}건)`);
  log(`  최신 매출 snapshot: ${snaps?.[0] ? `${snaps[0].business_date} r${snaps[0].revision}` : '없음 — 수신 0건'}`);
  if (lastRuns?.length) {
    log('\n  최근 실행:');
    for (const r of lastRuns) log(`    ${r.direction.padEnd(5)} ${r.status.padEnd(10)} ${r.completed_at ?? ''}  ${r.run_id}`);
  }
  log('');
  log('  ⚠️ 동기화 성공과 자료 신선도는 다릅니다. 원천이 오래됐으면 최신 실적이 아닙니다.');
  log('');
}

// ─────────────────────── 로컬 상태 파일 ───────────────────────

function readJsonIn(rel) {
  try { return JSON.parse(readFileSync(safeJoin(BRIDGE_ROOT, rel), 'utf8')); } catch { return null; }
}
function writeSyncStatus(patch) {
  const prev = readJsonIn('sync-status.json') ?? {};
  writeFileIn(BRIDGE_ROOT, 'sync-status.json', JSON.stringify({ ...prev, ...patch, updated_at: new Date().toISOString() }, null, 2));
}

// ─────────────────────────── main ───────────────────────────

const USAGE = `
Office ↔ 로컬 ↔ GPT 동기화 (BRIDGE-O1)

  node scripts/bridge.mjs login     자격증명 저장 (macOS Keychain)
  node scripts/bridge.mjs status    연결·마지막 동기화·열린 요청
  node scripts/bridge.mjs pull      Office → 로컬   (GPT 작업 시작 직전)
  node scripts/bridge.mjs push      outbox → Office (GPT 작업 끝날 때)
  node scripts/bridge.mjs logout

옵션:
  --workspace <uuid>   워크스페이스 지정 (기본: 전용 셸이 붙은 오피스)
  --root <경로>        로컬 루트 (기본: 공유 폴더 operations/bridge)
  --json               결과를 JSON 으로

이 명령은 모델 API 를 호출하지 않습니다. service_role 키를 쓰지 않고
대표 계정으로 로그인해 RLS 가 그대로 적용됩니다.
`;

try {
  if (cmd === 'login') await cmdLogin();
  else if (cmd === 'logout') cmdLogout();
  else if (cmd === 'pull') await cmdPull();
  else if (cmd === 'push') await cmdPush();
  else if (cmd === 'status') await cmdStatus();
  else { console.log(USAGE); process.exit(cmd ? 1 : 0); }
} catch (e) {
  die(e instanceof Error ? e.message : String(e));
}
