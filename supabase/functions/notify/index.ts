/**
 * @file supabase/functions/notify/index.ts
 * @description 이벤트 알림 단일 진입점 (Phase 1)
 * - 클라이언트가 도메인 변경 후 supabase.functions.invoke('notify', { body }) 로 호출.
 * - 수신자 결정(target 또는 워크스페이스 멤버) → 액터 제외 → 각자 종류 토글(checkPreference) → 발송.
 * - best-effort: 실패해도 호출측은 무시(글 저장 롤백 방지).
 * - 배포: supabase functions deploy notify --project-ref <ref>  (★ _shared import 때문에 CLI 필수)
 * - 재활용: _shared/push.ts (sendPushToUsers, checkPreference).
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
