/**
 * @file supabase/functions/notify/index.ts
 * @description 이벤트 알림 단일 진입점 (Phase 1)
 * - 클라이언트가 도메인 변경 후 supabase.functions.invoke('notify', { body }) 로 호출.
 * - 수신자 결정(target 또는 워크스페이스 멤버) → 액터 제외 → 각자 종류 토글(checkPreference) → 발송.
 * - best-effort: 실패해도 호출측은 무시(글 저장 롤백 방지).
 * - 배포: supabase functions deploy notify --project-ref <ref>  (★ _shared import 때문에 CLI 필수)
 * - 재활용: _shared/push.ts (sendPushToUsers, checkPreference).
 * - 부르는 쪽 셋 (마이그 068 부터 이 셋만):
 *     로그인한 멤버 (앱)          → 그 워크스페이스 멤버여야 하고, 액터는 본인
 *     본부 토큰 hq_token (sol-hq) → 토큰의 워크스페이스에만, 액터는 hq_act 가 정한 사람(본부 보고서를 쓰는 사람 · 그 워크스페이스 멤버일 때만)
 *     서버 (service-role 키)      → 그대로 믿는다 (cron)
 *   이 밖의 호출(공개 anon 키만 든 것)은 거절한다.
 */
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { sendPushToUsers, checkPreference } from '../_shared/push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type NotifyBody = {
  /** notification_preferences 의 컬럼 키 (notify_task_assigned 등) */
  type: string;
  workspace_id: string;
  actor_id?: string | null;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  /** 특정 수신자 (배정→담당자 등). 없으면 워크스페이스 전체 멤버 */
  target_user_ids?: string[];
  /** 본부(sol-hq) 보고서에서 한 일 - 본부 토큰 (hq_auth 로 워크스페이스 확인) */
  hq_token?: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: NotifyBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!body.type || !body.workspace_id || !body.title) {
    return json({ error: 'missing_fields' }, 400);
  }

  const supabase = getSupabaseAdmin();

  // 0) 호출자 검증 — 로그인 유저(클라이언트) 호출이면 위장 방지:
  //    · 해당 workspace 멤버여야 하고, actor_id는 본인으로 강제,
  //    · target_user_ids는 그 workspace 멤버로만 제한.
  //    서버(cron·service-role) 호출은 user가 없으므로 그대로 신뢰(기존 동작 유지).
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  let callerId: string | null = null;
  try { const { data } = await supabase.auth.getUser(token); callerId = data?.user?.id ?? null; } catch { callerId = null; }
  if (!callerId && body.hq_token) {
    // 본부 보고서 → 토큰 워크스페이스에만. 다른 워크스페이스로는 못 보낸다
    const { data: ws, error } = await supabase.rpc('hq_auth', { p_token: body.hq_token });
    if (error || !ws || ws !== body.workspace_id) return json({ error: 'forbidden' }, 403);
    if (!['notify_task_completed', 'notify_decision', 'notify_comment', 'notify_task_assigned'].includes(body.type)) return json({ error: 'bad_type' }, 400);
    const { data: m } = body.actor_id
      ? await supabase.from('workspace_members').select('user_id').eq('workspace_id', ws).eq('user_id', body.actor_id).maybeSingle()
      : { data: null };
    if (!m) {
      const { data: w } = await supabase.from('workspaces').select('created_by').eq('id', ws).maybeSingle();
      body.actor_id = (w as { created_by?: string } | null)?.created_by ?? null;
    }
    // 받는 사람을 정했으면 (회의 할 일 배정 → 담당자) 그 워크스페이스 멤버로만
    if (body.target_user_ids?.length) {
      const { data: members } = await supabase.from('workspace_members').select('user_id').eq('workspace_id', ws);
      const set = new Set((members ?? []).map((x: { user_id: string }) => x.user_id));
      body.target_user_ids = body.target_user_ids.filter((u) => set.has(u));
      if (!body.target_user_ids.length) return json({ ok: true, sent: 0 });
    }
  } else if (!callerId && token !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    return json({ error: 'forbidden' }, 403);
  }
  if (callerId) {
    const { data: me } = await supabase
      .from('workspace_members').select('user_id')
      .eq('workspace_id', body.workspace_id).eq('user_id', callerId).maybeSingle();
    if (!me) return json({ error: 'forbidden' }, 403);
    body.actor_id = callerId; // 액터 스푸핑 방지
    if (body.target_user_ids?.length) {
      const { data: members } = await supabase
        .from('workspace_members').select('user_id').eq('workspace_id', body.workspace_id);
      const set = new Set((members ?? []).map((m: { user_id: string }) => m.user_id));
      body.target_user_ids = body.target_user_ids.filter((u) => set.has(u));
    }
  }

  // 1) 수신자 결정
  let candidateIds: string[];
  if (body.target_user_ids?.length) {
    candidateIds = body.target_user_ids;
  } else {
    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', body.workspace_id);
    candidateIds = [...new Set((members ?? []).map((m: { user_id: string }) => m.user_id))];
  }

  // 2) 액터 본인 제외
  if (body.actor_id) candidateIds = candidateIds.filter((u) => u !== body.actor_id);
  if (!candidateIds.length) return json({ ok: true, sent: 0 });

  // 3) 개인별 종류 토글 필터 (컬럼 없으면 기본 true)
  const allowed: string[] = [];
  for (const uid of candidateIds) {
    const ok = await checkPreference(supabase, uid, body.type).catch(() => true);
    if (ok) allowed.push(uid);
  }
  if (!allowed.length) return json({ ok: true, sent: 0 });

  // 4) 인앱 알림센터 기록 (수신자마다 1행) — 푸시 꺼둔 사람도 앱에서 확인
  try {
    await supabase.from('notifications').insert(
      allowed.map((uid) => ({
        workspace_id: body.workspace_id, user_id: uid, actor_id: body.actor_id ?? null,
        type: body.type, title: body.title, body: body.body, url: body.url ?? null,
      })),
    );
  } catch (_) { /* 인박스 실패해도 푸시는 보냄 */ }

  // 5) 푸시 발송
  await sendPushToUsers(supabase, allowed, {
    title: body.title,
    body: body.body,
    url: body.url,
    tag: body.tag,
  });

  return json({ ok: true, sent: allowed.length });
});
