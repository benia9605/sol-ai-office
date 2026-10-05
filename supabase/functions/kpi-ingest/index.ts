/**
 * @file supabase/functions/kpi-ingest/index.ts
 * @description 외부 앱(운명랩·시목 등) → 오피스 KPI 수신 엔드포인트
 *
 * ★ 0.2.0 가드 (계약 §2 · GPT-R1-O1 / INT-009)
 *   이전 버전은 **전역 토큰 1개**(KPI_INGEST_TOKEN)를 모든 앱이 공유하고
 *   **요청 본문의 workspaceId** 를 그대로 신뢰했다 → 토큰 보유자가 아무 워크스페이스에나 쓸 수 있었다.
 *
 *   이제 토큰 → workspace 매핑은 DB(`ingest_credentials`)가 결정한다.
 *   저장은 sha256 해시만 하고 평문은 비교에만 쓴다. scope·environment·usage 도 그 행이 정한다.
 *
 *   legacy 호환 (계약 §2 "기존 형식을 즉시 전부 거절하면서 호환이 유지된다고 보고하지 않는다"):
 *     - 자격증명 행에 `legacy_body_workspace = true` 면 body.workspaceId 를 **허용하되
 *       그 행의 workspace_id 와 정확히 같을 때만** 통과시킨다. 다르면 403.
 *     - false(신규 기본)면 body 에 workspaceId 가 있으면 400 으로 거절한다(조용히 무시하지 않는다).
 *     - `ingest_credentials` 에 행이 없고 KPI_INGEST_TOKEN 이 맞으면 **legacy 전역 토큰 경로**로
 *       받아들이되 응답에 `deprecated: true` 를 붙여 전환이 필요함을 알린다.
 *       이 경로는 기존 운명랩 전송을 끊지 않기 위한 한시적 호환이며 워크스페이스 격리가 되지 않는다.
 *
 * 시크릿: supabase secrets set KPI_INGEST_TOKEN=<legacy 전역 토큰>  (전환 완료 후 제거)
 * 자격증명 발급(SQL 에디터):
 *   insert into ingest_credentials (workspace_id, name, token_sha256, legacy_body_workspace)
 *   values ('<ws uuid>', 'unmyunglab', encode(digest('<평문>','sha256'),'hex'), true);
 */
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-kpi-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** 계약 §8 오류 형태 */
function fail(status: number, code: string, message: string, retryable = false): Response {
  const traceId = crypto.randomUUID();
  console.error(`[kpi-ingest] ${code} trace=${traceId}`); // 토큰·본문은 로그에 쓰지 않는다
  return new Response(JSON.stringify({ error: { code, message, retryable, trace_id: traceId } }), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
function ok(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 숫자 필드 검증 — 문자열이 그대로 들어가 DB 오류가 나던 것을 막는다 */
function num(v: unknown, field: string): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`${field} 는 숫자여야 합니다`);
  }
  return v;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'POST only');

  const token = req.headers.get('x-kpi-token');
  if (!token) return fail(401, 'unauthorized', '수신 토큰이 필요합니다');

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return fail(400, 'invalid_json', 'invalid json'); }

  const sb = getSupabaseAdmin();

  // ── 1. 토큰 → workspace 매핑 (DB가 결정한다) ──
  const hash = await sha256Hex(token);
  const { data: creds, error: credErr } = await sb
    .from('ingest_credentials')
    .select('id, workspace_id, name, scopes, environment, usage, legacy_body_workspace, is_active, revoked_at')
    .eq('token_sha256', hash)
    .limit(1);

  // 테이블이 아직 없으면(마이그 060 미적용) legacy 경로만 남는다.
  const tableMissing = !!credErr;
  const cred = creds?.[0];

  let workspaceId: string;
  let deprecated = false;

  if (cred) {
    if (!cred.is_active || cred.revoked_at) return fail(403, 'credential_revoked', '폐기된 자격증명입니다');
    if (!(cred.scopes ?? []).includes('snapshots:ingest') && !(cred.scopes ?? []).includes('kpi:ingest')) {
      return fail(403, 'scope_missing', '이 자격증명에는 수신 권한이 없습니다');
    }
    workspaceId = cred.workspace_id;

    // legacy adapter — body.workspaceId 처리
    const bodyWs = typeof body.workspaceId === 'string' ? body.workspaceId : null;
    if (bodyWs) {
      if (!cred.legacy_body_workspace) {
        // 조용히 무시하지 않는다 — 발신자가 잘못 믿게 되는 것을 막는다(계약 §2)
        return fail(400, 'body_workspace_not_allowed',
          'workspaceId 는 본문에 넣지 않습니다. 자격증명에 고정된 워크스페이스로 저장됩니다.');
      }
      if (bodyWs !== cred.workspace_id) {
        return fail(403, 'workspace_mismatch',
          '본문의 workspaceId 가 이 자격증명의 워크스페이스와 다릅니다.');
      }
      deprecated = true; // 전환 필요
    }
  } else {
    // ── legacy 전역 토큰 경로 (한시적) ──
    const legacyToken = Deno.env.get('KPI_INGEST_TOKEN');
    if (!legacyToken || token !== legacyToken) return fail(401, 'unauthorized', '인증에 실패했습니다');
    const bodyWs = typeof body.workspaceId === 'string' ? body.workspaceId : null;
    if (!bodyWs || !UUID_RE.test(bodyWs)) {
      return fail(400, 'workspace_required', 'workspaceId(UUID)가 필요합니다');
    }
    // ⚠️ 이 경로는 워크스페이스 격리가 되지 않는다. 전환 전까지만 유지한다.
    workspaceId = bodyWs;
    deprecated = true;
    console.warn(`[kpi-ingest] legacy 전역 토큰 경로 사용 — ingest_credentials 전환 필요 (table_missing=${tableMissing})`);
  }

  // ── 2. 입력 검증 ──
  const source = typeof body.source === 'string' ? body.source.trim() : '';
  const date = typeof body.date === 'string' ? body.date : '';
  if (!source) return fail(400, 'source_required', 'source 가 필요합니다');
  if (!DATE_RE.test(date)) return fail(400, 'bad_date', 'date 는 YYYY-MM-DD 여야 합니다');
  // 달력 검사 — 2026-02-30 같은 값을 통과시키지 않는다
  const [y, mo, d] = date.split('-').map(Number);
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) {
    return fail(400, 'bad_date', '달력에 없는 날짜입니다');
  }

  let row: Record<string, unknown>;
  try {
    row = {
      workspace_id: workspaceId,
      source,
      date,
      revenue: num(body.revenue, 'revenue'),
      orders: num(body.orders, 'orders'),
      visitors: num(body.visitors, 'visitors'),
      // ⚠️ conversion_rate: 계약 §6 — 트래픽이 미연결인 원천에서는 보내지 않는다.
      //    값이 오면 저장은 하되 Office UI 는 traffic quality 없이 전환율을 표시하지 않는다.
      conversion_rate: num(body.conversionRate, 'conversionRate'),
      inquiries: num(body.inquiries, 'inquiries'),
      extra: body.extra ?? null,
    };
  } catch (e) {
    return fail(422, 'bad_field', e instanceof Error ? e.message : '필드 형식 오류');
  }

  // ── 3. 저장 ──
  const { error } = await sb.from('external_kpis').upsert(row, { onConflict: 'workspace_id,source,date' });
  if (error) return fail(500, 'store_failed', '저장에 실패했습니다', true);

  if (cred) {
    await sb.from('ingest_credentials').update({ last_used_at: new Date().toISOString() })
      .eq('id', cred.id).then(() => {}, () => {});
  }

  return ok({
    ok: true,
    workspace_id: workspaceId,
    ...(deprecated
      ? { deprecated: true, note: 'body.workspaceId 와 전역 토큰은 전환 예정입니다. 자격증명별 토큰으로 바꿔주세요.' }
      : {}),
  });
});
