/**
 * @file supabase/functions/erp-proxy/index.ts
 * @description 시목앱 ERP 읽기 API 프록시 (GET only)
 * - 시목 API 키(SIMOK_API_KEY)를 서버 Secret에 보관 → 프론트는 키를 절대 못 봄.
 * - AI Office 프론트가 supabase.functions.invoke('erp-proxy', { body:{ path, query } }) 로 호출
 *   → 이 함수가 x-api-key 붙여 https://simok.co.kr/api/erp/v1/{path} 로 전달.
 * - 시목 API는 CORS 미부착(브라우저 직접 호출 차단)이라 반드시 이 서버 프록시를 경유.
 * - path 화이트리스트(products|summary|sales-daily)만 허용 → 읽기 전용.
 *
 * 배포:  supabase functions deploy erp-proxy
 * 시크릿: supabase secrets set SIMOK_API_KEY=<시목앱이 발급한 키>   (평문은 코드·git 어디에도 없음)
 * 인증:  Supabase 기본 JWT 검증(로그인한 AI Office 유저만 호출 가능).
 */
const SIMOK_BASE = 'https://simok.co.kr/api/erp/v1';
const SIMOK_KEY = Deno.env.get('SIMOK_API_KEY') || '';
const ALLOWED = new Set(['products', 'summary', 'sales-daily']);

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!SIMOK_KEY) return json({ error: 'SIMOK_API_KEY 미설정 (supabase secrets set 필요)' }, 500);

  let body: { path?: string; query?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json body' }, 400);
  }

  const path = String(body.path || '').replace(/^\/+/, '');
  if (!ALLOWED.has(path)) return json({ error: `허용되지 않은 path: ${path}` }, 400);

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(body.query || {})) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const url = `${SIMOK_BASE}/${path}${qs.toString() ? `?${qs.toString()}` : ''}`;

  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: { 'x-api-key': SIMOK_KEY, 'Accept': 'application/json' },
    });
    const text = await r.text();
    // 시목 응답(상태코드 포함)을 그대로 전달
    return new Response(text, {
      status: r.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return json({ error: `시목 API 호출 실패: ${e instanceof Error ? e.message : String(e)}` }, 502);
  }
});
