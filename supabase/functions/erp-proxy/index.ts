/**
 * @file supabase/functions/erp-proxy/index.ts
 * @description 시목앱 ERP 읽기 API 프록시 (GET only) + workspace 가드
 * - 시목 API 키(SIMOK_API_KEY)를 서버 Secret에 보관 → 프론트는 키를 절대 못 봄.
 * - AI Office 프론트가 supabase.functions.invoke('erp-proxy', { body:{ workspaceId, path, query } }) 로 호출
 *   → 이 함수가 x-api-key 붙여 https://simok.co.kr/api/erp/v1/{path} 로 전달.
 * - 시목 API는 CORS 미부착(브라우저 직접 호출 차단)이라 반드시 이 서버 프록시를 경유.
 * - path 화이트리스트(products|summary|sales-daily|daily-snapshot)만 허용 → 읽기 전용.
 *
 * ★ 가드 (계약 0.2.0 §2 · GPT-R1-O1 / INT-009)
 *   이전 버전은 Supabase 기본 JWT 검증만 해서 **로그인한 아무 유저나** 시목 ERP 전체를 읽을 수 있었다.
 *   이제 호출자는 workspaceId 를 반드시 보내고, 서버가 **호출자 본인의 JWT로** workspaces 를 조회한다.
 *   RLS(my_workspace_ids) 가 적용되므로 "그 workspace 멤버인지"는 DB가 증명한다 → 멤버십 위조 불가.
 *   그 workspace 의 erp_source 가 'simok_api' 여야만 시목을 호출한다.
 *   source_system 문자열이나 body 의 다른 값은 권한 증명이 아니다.
 *   query 는 path별 화이트리스트 키만 통과시킨다(임의 파라미터 주입 차단).
 *
 * 배포:  supabase functions deploy erp-proxy
 * 시크릿: supabase secrets set SIMOK_API_KEY=<시목앱이 발급한 키>   (평문은 코드·git 어디에도 없음)
 * 인증:  Supabase 기본 JWT 검증 + 위 workspace 가드.
 */
const SIMOK_BASE = 'https://simok.co.kr/api/erp/v1';
const SIMOK_KEY = Deno.env.get('SIMOK_API_KEY') || '';
const SB_URL = Deno.env.get('SUPABASE_URL') || '';
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') || '';

/** 허용 path → 허용 query 키 (그 외 키는 버린다) */
const ALLOWED: Record<string, Set<string>> = {
  'products': new Set(['business_entity', 'limit', 'cursor', 'status']),
  'summary': new Set(['from', 'to', 'cursor']),
  'sales-daily': new Set(['from', 'to', 'cursor', 'source']),
  'daily-snapshot': new Set(['date']),
};

/** 외부 호출 타임아웃 — 계약 0.2.0 §8: 15초 시험 초기값, AbortController 로 실제 요청을 끊는다 */
const UPSTREAM_TIMEOUT_MS = 15_000;

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** 계약 0.2.0 §8 오류 형태 */
function fail(status: number, code: string, message: string, retryable = false): Response {
  const traceId = crypto.randomUUID();
  // 토큰·키·고객정보는 로그에 쓰지 않는다. code/trace 만 남긴다.
  console.error(`[erp-proxy] ${code} trace=${traceId}`);
  return new Response(JSON.stringify({ error: { code, message, retryable, trace_id: traceId } }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'POST only');
  if (!SIMOK_KEY) return fail(500, 'not_configured', 'SIMOK_API_KEY 미설정 (supabase secrets set 필요)');
  // ★ fail-CLOSED: Supabase env 가 없으면 가드를 할 수 없으므로 통과시키지 않는다.
  if (!SB_URL || !SB_ANON) return fail(503, 'auth_unavailable', 'workspace 가드를 평가할 수 없어 차단했습니다');

  const authHeader = req.headers.get('Authorization') || '';
  if (!/^Bearer\s+\S+/i.test(authHeader)) return fail(401, 'unauthorized', '로그인이 필요합니다');

  let body: { workspaceId?: string; path?: string; query?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'invalid_json', 'invalid json body');
  }

  const path = String(body.path || '').replace(/^\/+/, '');
  const allowedQuery = ALLOWED[path];
  if (!allowedQuery) return fail(400, 'path_not_allowed', `허용되지 않은 path: ${path}`);

  const workspaceId = String(body.workspaceId || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workspaceId)) {
    return fail(400, 'workspace_required', 'workspaceId(UUID)가 필요합니다');
  }

  // ── ★ workspace 가드 ──
  // 호출자 본인의 JWT로 조회한다. service_role 을 쓰면 RLS가 꺼져 멤버십 검증이 사라진다.
  // RLS(workspaces_select → my_workspace_ids)가 멤버가 아닌 workspace 를 0행으로 만든다.
  let erpSource: string | null = null;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/workspaces?id=eq.${encodeURIComponent(workspaceId)}&select=id,erp_source`,
      { headers: { Authorization: authHeader, apikey: SB_ANON, Accept: 'application/json' } },
    );
    if (r.status === 401 || r.status === 403) return fail(401, 'unauthorized', '로그인이 만료되었습니다');
    if (!r.ok) return fail(503, 'guard_unavailable', 'workspace 확인에 실패해 차단했습니다', true);
    const rows = (await r.json()) as { id: string; erp_source: string | null }[];
    // 멤버가 아니거나 없는 workspace → 0행. 존재 여부를 알려주지 않기 위해 같은 403.
    if (!Array.isArray(rows) || rows.length === 0) {
      return fail(403, 'workspace_forbidden', '이 워크스페이스에 접근할 수 없습니다');
    }
    erpSource = rows[0].erp_source;
  } catch {
    return fail(503, 'guard_unavailable', 'workspace 확인에 실패해 차단했습니다', true);
  }

  // 연결이 켜진 workspace 만 원천을 호출한다. 다른 브랜드가 시목을 읽을 수 없다.
  if (erpSource !== 'simok_api') {
    return fail(403, 'connection_not_enabled', '이 워크스페이스는 시목 ERP에 연결되어 있지 않습니다');
  }

  // ── query 화이트리스트 ──
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(body.query || {})) {
    if (!allowedQuery.has(k)) continue; // 허용 키가 아니면 조용히 버린다(원천에 그대로 넘기지 않는다)
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const url = `${SIMOK_BASE}/${path}${qs.toString() ? `?${qs.toString()}` : ''}`;

  // ── 원천 호출 (AbortController 로 실제 요청을 끊는다) ──
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: { 'x-api-key': SIMOK_KEY, 'Accept': 'application/json' },
      signal: ac.signal,
    });
    const text = await r.text();
    // 시목 응답(상태코드 포함)을 그대로 전달
    return new Response(text, {
      status: r.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return fail(504, 'upstream_timeout', `시목 ERP 응답이 ${UPSTREAM_TIMEOUT_MS}ms를 넘겼습니다`, true);
    }
    return fail(502, 'upstream_failed', '시목 API 호출에 실패했습니다', true);
  } finally {
    clearTimeout(timer); // timer 정리 — Promise.race 와 달리 타이머가 남지 않는다
  }
});
