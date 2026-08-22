// ============================================================
// supabase/functions/notify  — 단일 푸시 진입점
//
// 클라이언트가 도메인 변경 후 supabase.functions.invoke('notify', { body: ... })
// 로 호출. 인증된 사용자가 actor 가 되며, 서버 측에서 서비스 롤 권한으로
// 알림 설정 (workspace admin + 개인 prefs) 확인 후 sendPushToUsers 호출.
//
// 환경 변수:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT (push.ts 에서 사용)
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendPushToUsers, type PushPayload } from "../_shared/push.ts";

type EventType =
  | "join_request"
  | "join_approved"
  | "member_joined"
  | "new_meeting"
  | "new_note"
  | "new_task"
  | "task_completed"
  | "new_insight"
  | "new_writing"
  | "new_reading"
  | "new_agenda"
  | "new_notice"
  | "attendance_reported"
  | "guest_application"
  | "comment"
  | "like"
  | "dev_message";

type NotifyBody = {
  type: EventType;
  workspace_id: string;
  /** 누가 발생시켰는지 — 자기 자신은 알림에서 제외 */
  actor_id?: string | null;
  /** 알림 본문에 쓰일 정보 */
  title: string;
  body: string;
  url?: string;
  tag?: string;
  /** new_task / join_approved 처럼 특정 사용자에게만 보내고 싶을 때 */
  target_user_ids?: string[];
};

// deno-lint-ignore no-explicit-any
const Deno = (globalThis as any).Deno;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: cors(),
    });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  let body: NotifyBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!body.type || !body.workspace_id || !body.title) {
    return json({ error: "missing_fields" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1) 워크스페이스 운영자 글로벌 토글 확인
  const { data: adminRow } = await supabase
    .from("notification_admin")
    .select("enabled")
    .eq("workspace_id", body.workspace_id)
    .maybeSingle();
  const globally =
    adminRow?.enabled?.[body.type] === undefined
      ? true
      : adminRow!.enabled[body.type] === true;
  if (!globally) return json({ ok: true, skipped: "admin_off" });

  // 2) 대상 사용자 결정
  let candidateIds: string[] = [];
  if (body.target_user_ids?.length) {
    candidateIds = body.target_user_ids;
  } else {
    const recipientsResp = await getRecipients(
      supabase,
      body.type,
      body.workspace_id,
    );
    candidateIds = recipientsResp;
  }

  // actor 제외
  if (body.actor_id) {
    candidateIds = candidateIds.filter((u) => u !== body.actor_id);
  }
  if (!candidateIds.length) return json({ ok: true, sent: 0 });

  // 3) 개인 prefs 필터
  const { data: prefs } = await supabase
    .from("notification_prefs")
    .select("user_id, enabled, preferences")
    .in("user_id", candidateIds);
  const prefsMap = new Map(
    // deno-lint-ignore no-explicit-any
    (prefs ?? []).map((p: any) => [p.user_id, p]),
  );

  const finalIds = candidateIds.filter((uid) => {
    const p = prefsMap.get(uid);
    if (!p) return true; // 기본값: 알림 받음
    if (p.enabled === false) return false;
    const t = p.preferences?.[body.type];
    return t === undefined ? true : t === true;
  });

  if (!finalIds.length) return json({ ok: true, sent: 0 });

  // 4) 발송
  const payload: PushPayload = {
    title: body.title,
    body: body.body,
    url: body.url,
    tag: body.tag,
  };
  await sendPushToUsers(supabase, finalIds, payload);

  return json({ ok: true, sent: finalIds.length });
});

// deno-lint-ignore no-explicit-any
async function getRecipients(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  type: EventType,
  workspaceId: string,
): Promise<string[]> {
  switch (type) {
    case "join_request":
    case "dev_message": {
      // 운영자 전용
      const { data } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .in("role", ["owner", "admin"]);
      return (data ?? []).map((r: { user_id: string }) => r.user_id);
    }
    // guest_application 도 여기(default) 로 떨어진다 — 게스트 섭외는 팀 전체가
    // 같이 보기로 해서 운영자 전용으로 좁히지 않았다. 좁히려면 위 case 에 추가.
    default: {
      // 모든 active 멤버 (guest 제외)
      const { data } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .in("role", ["owner", "admin", "member"]);
      return (data ?? []).map((r: { user_id: string }) => r.user_id);
    }
  }
}

function cors(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors() },
  });
}
