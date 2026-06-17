/**
 * @file supabase/functions/kpi-ingest/index.ts
 * @description 외부 앱(운명랩·시목 등) → 오피스 KPI 수신 엔드포인트
 * - 외부 앱이 매일 자기 KPI를 이 엔드포인트로 POST → external_kpis upsert
 * - 인증: 헤더 x-kpi-token === Deno.env KPI_INGEST_TOKEN (오피스가 발급, 앱에 공유)
 * - 시크릿 설정: supabase secrets set KPI_INGEST_TOKEN=<랜덤문자열>
 *
 * 요청 예:
 *   POST /functions/v1/kpi-ingest
 *   headers: { x-kpi-token, content-type: application/json }
 *   body: { workspaceId, source, date, revenue, orders, visitors, conversionRate, inquiries, extra }
 */
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-kpi-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  // 토큰 인증
  const token = req.headers.get('x-kpi-token');
  if (!token || token !== Deno.env.get('KPI_INGEST_TOKEN')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }); }

  const { workspaceId, source, date } = body ?? {};
  if (!workspaceId || !source || !date) {
    return new Response(JSON.stringify({ error: 'workspaceId, source, date 필수' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  const row = {
    workspace_id: workspaceId,
    source: String(source),
    date: String(date), // 'YYYY-MM-DD'
    revenue: body.revenue ?? null,
    orders: body.orders ?? null,
    visitors: body.visitors ?? null,
    conversion_rate: body.conversionRate ?? null,
    inquiries: body.inquiries ?? null,
    extra: body.extra ?? null,
  };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('external_kpis')
    .upsert(row, { onConflict: 'workspace_id,source,date' });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
});
