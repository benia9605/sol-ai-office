# 소셜(좋아요·댓글·답글) + 푸시 알림 — 전체 이식 가이드

> **목적** — 밋업 앱에서 실제로 돌아가고 있는 「모든 글에 좋아요·댓글·답글」 +
> 「글·댓글·좋아요·할일 배정·회의 일정이 바뀌면 각자 폰으로 푸시」 기능 일체를
> 다른 앱(AI 오피스)에 **복붙 수준으로 옮길 수 있게** 정리한 문서.
>
> 스키마 SQL · Edge Function · 클라이언트 모듈 · Service Worker · React UI 컴포넌트 ·
> 디자인 토큰까지 전부 포함. 앱 이름/경로만 바꾸면 동작한다.
>
> 전제 스택: **Vite + React 19 + TS + Tailwind v4 + Supabase(Postgres/Auth/Edge Functions)**.
> Next.js/Express 여도 3장(DB)·4장(Edge Function)·5장(SW)은 그대로,
> 6장 이후의 클라이언트 코드만 프레임워크에 맞게 바꾸면 된다.

---

## 목차

1. [전체 아키텍처 한 장](#1-전체-아키텍처-한-장)
2. [설계 원칙 8가지](#2-설계-원칙-8가지)
3. [DB — 좋아요 · 댓글 · 답글 스키마](#3-db--좋아요--댓글--답글-스키마)
4. [DB — 푸시 알림 인프라 스키마](#4-db--푸시-알림-인프라-스키마)
5. [서버 — Edge Function `notify` + Web Push 송신 모듈](#5-서버--edge-function-notify--web-push-송신-모듈)
6. [클라이언트 — Service Worker · 구독 · 설정 모듈](#6-클라이언트--service-worker--구독--설정-모듈)
7. [데이터 레이어 — 좋아요/댓글/답글 + 알림 호출 패턴](#7-데이터-레이어--좋아요댓글답글--알림-호출-패턴)
8. [회의 메뉴 — 일정 · 참석 · 회의록 · 안건/투표](#8-회의-메뉴--일정--참석--회의록--안건투표)
9. [할일 — 배정 · 재배정 · 완료 · 할일 소셜](#9-할일--배정--재배정--완료--할일-소셜)
10. [UI / 디자인 코드 — 좋아요·댓글 블록](#10-ui--디자인-코드--좋아요댓글-블록)
11. [UI / 디자인 코드 — 알림 설정 화면](#11-ui--디자인-코드--알림-설정-화면)
12. [알림 종류 매트릭스 (누가 · 언제 · 누구에게)](#12-알림-종류-매트릭스-누가--언제--누구에게)
13. [셋업 체크리스트 (VAPID → 배포까지)](#13-셋업-체크리스트-vapid--배포까지)
14. [iOS / Android 실전 함정](#14-ios--android-실전-함정)
15. [확장 아이디어](#15-확장-아이디어)

---

## 1. 전체 아키텍처 한 장

```
[사용자 A 브라우저]
   │ 1. 글에 좋아요 / 댓글 / 답글 / 할일 배정 / 일정 등록
   ▼
src/lib/data/<도메인>.ts        ← 도메인 mutation 함수 (유일한 진입점)
   │ 2. Supabase 테이블에 insert/update  (RLS 로 권한 검증)
   │ 3. recordActivity()  → activities 테이블 (인앱 활동 피드)
   │ 4. notify({ type, workspace_id, actor_id, title, body, url, tag, target_user_ids })
   ▼
supabase/functions/notify        ← 단일 푸시 진입점 (Deno, service_role)
   │ 4-1. notification_admin  : 워크스페이스 글로벌 토글 확인
   │ 4-2. 수신자 결정          : target_user_ids 있으면 그것, 없으면 전체 멤버
   │ 4-3. actor 본인 제외
   │ 4-4. notification_prefs  : 개인별 종류 토글 필터
   ▼
supabase/functions/_shared/push.ts
   │ 5. push_subscriptions 조회 → 기기별 VAPID JWT 서명 + aes128gcm 암호화
   ▼
[FCM / Apple Push / Mozilla autopush]
   ▼
public/sw.js  (각 사용자 폰의 Service Worker)
   │ 6. push 이벤트 → showNotification()
   │ 7. notificationclick → 해당 URL 로 앱 포커스/이동
   ▼
[사용자 B·C·D 폰 알림]
```

**핵심**: 도메인 함수는 `notify()` 한 줄만 부른다. "누구에게 보낼지 / 보낼지 말지"의
정책은 전부 서버(Edge Function)와 DB(prefs 테이블)에 있다. 클라이언트는 정책을 모른다.

---

## 2. 설계 원칙 8가지

| # | 원칙 | 이유 |
| --- | --- | --- |
| 1 | **알림은 best-effort** — `notify()` 는 절대 throw 하지 않음 | 푸시 실패가 글 저장을 롤백시키면 안 됨 |
| 2 | **actor 본인은 항상 제외** | 내가 누른 좋아요 알림이 나한테 오면 최악 |
| 3 | **정책은 서버에, 호출은 클라이언트에** | 토글/권한 로직이 화면마다 흩어지지 않음 |
| 4 | **좋아요는 켤 때만 알림** (끌 때 없음) | 토글 스팸 방지 |
| 5 | **`tag` 로 같은 대상 알림 묶기** | 잠금화면에 같은 글 알림이 10개 쌓이지 않음 |
| 6 | **댓글은 글 작성자에게, 답글은 부모 댓글 작성자에게** | 관련 없는 사람에게 안 감 |
| 7 | **좋아요는 낙관적 업데이트(Optimistic UI)** | 서버 왕복 기다리면 "안 눌리는" 느낌 |
| 8 | **모든 소셜 테이블은 동일 패턴** | `<자원>_likes` / `<자원>_comments(+parent_id)` 이름 규칙 고정 |

---

## 3. DB — 좋아요 · 댓글 · 답글 스키마

### 3.0 전제: 멤버십 헬퍼 함수

모든 RLS 정책이 이 두 함수에 의존한다. 먼저 있어야 한다.

```sql
-- 이 워크스페이스(=팀/오피스)의 멤버인가?
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

-- 운영자(owner/admin) 인가?
create or replace function public.is_workspace_admin(ws uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;
```

> `security definer` 가 아니면 RLS 재귀(정책 안에서 정책 평가)로 무한루프가 난다. 필수.

### 3.1 범용 템플릿 — 자원 하나에 좋아요+댓글 붙이기

`<RES>` 를 자원명(`post`, `writing`, `task`, `note`, `agenda` …)으로 치환해서 쓴다.
`<RES>s` 는 본체 테이블이고, `workspace_id` 컬럼과 `user_id`(작성자) 컬럼이 있다고 가정.

```sql
-- ============================================================
-- <RES> — 좋아요 + 댓글(+답글)
-- ============================================================

-- ─── 좋아요: 복합 PK 로 "1인 1좋아요" 를 DB 레벨에서 강제 ───
create table if not exists public.<RES>_likes (
  <RES>_id   uuid not null references public.<RES>s(id) on delete cascade,
  user_id    uuid not null references public.user_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (<RES>_id, user_id)
);
create index if not exists <RES>_likes_user_idx on public.<RES>_likes(user_id);

-- ─── 댓글: parent_id 가 null 이면 최상위, 값이 있으면 1단계 답글 ───
create table if not exists public.<RES>_comments (
  id         uuid primary key default gen_random_uuid(),
  <RES>_id   uuid not null references public.<RES>s(id) on delete cascade,
  user_id    uuid not null references public.user_profiles(user_id) on delete cascade,
  content    text not null,
  parent_id  uuid references public.<RES>_comments(id) on delete cascade,
  created_at timestamptz not null default now()
);
-- 목록 정렬이 (자원, 시간) 이라 복합 인덱스
create index if not exists <RES>_comments_<RES>_idx
  on public.<RES>_comments(<RES>_id, created_at);

-- ============================================================
-- RLS
-- ============================================================
alter table public.<RES>_likes    enable row level security;
alter table public.<RES>_comments enable row level security;

-- 조회: 그 자원이 속한 워크스페이스의 멤버면 OK
create policy <RES>_likes_select on public.<RES>_likes
  for select to authenticated using (
    exists (select 1 from public.<RES>s r
            where r.id = <RES>_id and public.is_workspace_member(r.workspace_id))
  );

-- 좋아요 등록/취소: 본인 행만
create policy <RES>_likes_insert on public.<RES>_likes
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.<RES>s r
                where r.id = <RES>_id and public.is_workspace_member(r.workspace_id))
  );
create policy <RES>_likes_delete on public.<RES>_likes
  for delete to authenticated using (user_id = auth.uid());

create policy <RES>_comments_select on public.<RES>_comments
  for select to authenticated using (
    exists (select 1 from public.<RES>s r
            where r.id = <RES>_id and public.is_workspace_member(r.workspace_id))
  );
create policy <RES>_comments_insert on public.<RES>_comments
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.<RES>s r
                where r.id = <RES>_id and public.is_workspace_member(r.workspace_id))
  );
-- 삭제: 본인 댓글 or 운영자
create policy <RES>_comments_delete on public.<RES>_comments
  for delete to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.<RES>s r
               where r.id = <RES>_id and public.is_workspace_admin(r.workspace_id))
  );

notify pgrst, 'reload schema';   -- PostgREST 스키마 캐시 갱신 (안 하면 404)
```

### 3.2 밋업이 실제로 붙인 자원 목록

| 자원 | 좋아요 테이블 | 댓글 테이블 | 비고 |
| --- | --- | --- | --- |
| 인사이트 | `insight_likes` | `insight_comments` | 원형 패턴 |
| 글쓰기 | `writing_likes` | `writing_comments` | 마이그 018 |
| 독서 챌린지 | `reading_likes` | `reading_comments` | 마이그 018 |
| 독서 노트 | `reading_note_likes` | `reading_note_comments` | 마이그 023 |
| **할일** | `task_likes` | `task_comments` | 마이그 047 — 「확인했어요」 용도 |
| 안건 | (없음, 투표로 대체) | `agenda_comments` | 마이그 040 |

AI 오피스라면 최소: **문서/포스트 · 회의록 · 안건 · 할일** 4개에 붙이면 된다.

### 3.3 답글(`parent_id`) 을 나중에 추가할 때 — 멱등 마이그레이션

이미 댓글 테이블이 여러 개 있는 상태에서 답글 기능만 추가하는 경우:

```sql
-- 048 — 댓글 답글 (parent_id)
-- `if exists` + `if not exists` 로 방어: 아직 없는 테이블은 조용히 건너뛰고,
-- 여러 번 재실행해도 안전(idempotent).
alter table if exists public.post_comments
  add column if not exists parent_id uuid
  references public.post_comments(id) on delete cascade;

alter table if exists public.task_comments
  add column if not exists parent_id uuid
  references public.task_comments(id) on delete cascade;

alter table if exists public.agenda_comments
  add column if not exists parent_id uuid
  references public.agenda_comments(id) on delete cascade;

notify pgrst, 'reload schema';
```

> RLS 는 그대로 둔다 — `parent_id` 는 일반 컬럼이라 기존 insert/select/delete 정책이 그대로 적용된다.
> 부모 댓글이 삭제되면 `on delete cascade` 로 답글도 같이 사라진다 (고아 답글 방지).

### 3.4 인앱 활동 피드 (`activities`)

푸시와 별개로 "지난 활동" 타임라인을 만들려면:

```sql
create table public.activities (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references public.user_profiles(user_id) on delete cascade,
  action        text not null,          -- 'commented_post' | 'liked_post' | 'completed_task' ...
  resource_type text,                   -- 'post' | 'task' | 'note' | 'agenda'
  resource_id   uuid,
  metadata      jsonb not null default '{}'::jsonb,  -- { title, excerpt, ... }
  created_at    timestamptz not null default now()
);
create index activities_ws_idx on public.activities(workspace_id, created_at desc);

alter table public.activities enable row level security;
create policy activities_select on public.activities
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy activities_insert on public.activities
  for insert to authenticated with check (
    user_id = auth.uid() and public.is_workspace_member(workspace_id)
  );
```

도메인 함수에서 `notify()` 바로 앞에 `recordActivity()` 를 같이 부르는 게 규칙이다.
(푸시는 휘발, 활동 피드는 영구 기록.)

---

## 4. DB — 푸시 알림 인프라 스키마

테이블 4개면 끝난다.

```sql
-- ============================================================
-- Web Push 알림 인프라
--   push_subscriptions  — 기기별 구독 (한 사람이 폰+PC 여러 기기 가능)
--   notification_prefs  — 사용자별 종류 토글
--   notification_admin  — 워크스페이스 글로벌 토글 (운영자 관리)
--   notification_log    — 중복 발송 방지용 (선택)
-- ============================================================

-- ---------- 1) 구독 ----------
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.user_profiles(user_id) on delete cascade,
  endpoint    text not null,      -- 브라우저가 발급한 푸시 서버 URL
  p256dh      text not null,      -- 공개키 (payload 암호화용)
  auth        text not null,      -- auth secret
  created_at  timestamptz not null default now(),
  unique (user_id, endpoint)      -- ★ 같은 기기 재구독 시 upsert 되도록
);
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- 2) 사용자별 알림 토글 ----------
-- preferences JSONB — 모두 boolean, 키가 없으면 true(받음) 로 간주.
-- {
--   "new_post": true, "new_meeting": true, "new_note": true,
--   "new_task": true, "task_completed": true, "new_agenda": true,
--   "comment": true, "like": true, ...
-- }
create table public.notification_prefs (
  user_id     uuid primary key references public.user_profiles(user_id) on delete cascade,
  enabled     boolean not null default true,          -- 마스터 스위치
  preferences jsonb   not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;
create policy notification_prefs_own on public.notification_prefs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- 3) 워크스페이스 글로벌 토글 (운영자가 끔) ----------
create table public.notification_admin (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  enabled      jsonb not null default '{
    "new_post":       true,
    "new_meeting":    true,
    "new_note":       true,
    "new_task":       true,
    "task_completed": true,
    "new_agenda":     true,
    "new_notice":     true,
    "member_joined":  true,
    "attendance_reported": true,
    "comment":        true,
    "like":           false
  }'::jsonb,
  updated_at   timestamptz not null default now()
);

alter table public.notification_admin enable row level security;
create policy notification_admin_select on public.notification_admin
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy notification_admin_update on public.notification_admin
  for all to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- 기존 워크스페이스에 기본 row 보장
insert into public.notification_admin (workspace_id)
select id from public.workspaces
on conflict (workspace_id) do nothing;

-- ---------- 4) 중복 발송 방지 로그 (선택) ----------
create table public.notification_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.user_profiles(user_id) on delete cascade,
  type       text not null,
  ref_key    text not null,
  created_at timestamptz not null default now(),
  unique (user_id, type, ref_key)   -- 같은 (사람, 종류, 대상) 은 한 번만
);
create index notification_log_user_idx on public.notification_log(user_id, created_at desc);

alter table public.notification_log enable row level security;
create policy notification_log_own on public.notification_log
  for select to authenticated using (user_id = auth.uid());
```

> **`like` 기본값이 `false`** 인 것에 주의 — 좋아요 알림은 소음이 크다.
> 밋업은 워크스페이스 기본값으로 꺼두고, 원하는 사람만 개인 설정에서 켜게 했다.
> AI 오피스도 이 기본값을 권장.

### 4.1 가입 시 기본 prefs row 자동 생성

`auth.users` 트리거에 한 줄 추가한다.

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  default_workspace_id uuid;
begin
  insert into public.user_profiles (user_id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (user_id) do nothing;

  -- ★ 알림 기본 설정 row
  insert into public.notification_prefs (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  -- 단일 오피스라면 첫 워크스페이스에 자동 배치
  select id into default_workspace_id
  from public.workspaces order by created_at asc limit 1;

  if default_workspace_id is not null then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (default_workspace_id, new.id, 'guest')
    on conflict (workspace_id, user_id) do nothing;
  end if;

  return new;
end;
$$;
```

> row 가 없어도 Edge Function 이 "기본값 = 받음" 으로 처리하므로 필수는 아니다.
> 다만 설정 화면에서 upsert 대신 update 를 쓰고 싶다면 있는 편이 편하다.

---

## 5. 서버 — Edge Function `notify` + Web Push 송신 모듈

### 5.1 `supabase/functions/notify/index.ts` — 단일 진입점

```ts
// ============================================================
// supabase/functions/notify — 단일 푸시 진입점
//
// 클라이언트가 도메인 변경 후 supabase.functions.invoke('notify', { body })
// 로 호출. 서버가 service_role 권한으로 알림 설정(글로벌 + 개인)을 확인한 뒤
// sendPushToUsers 를 호출한다.
//
// 필요한 환경변수(secrets):
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendPushToUsers, type PushPayload } from "../_shared/push.ts";

type EventType =
  | "member_joined"
  | "new_post"
  | "new_meeting"
  | "new_note"
  | "new_task"
  | "task_completed"
  | "new_agenda"
  | "new_notice"
  | "attendance_reported"
  | "comment"
  | "like";

type NotifyBody = {
  type: EventType;
  workspace_id: string;
  /** 누가 발생시켰는지 — 자기 자신은 수신자에서 제외 */
  actor_id?: string | null;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  /** 특정 사용자에게만 보낼 때 (댓글→글쓴이, 배정→담당자 등) */
  target_user_ids?: string[];
};

// deno-lint-ignore no-explicit-any
const Deno = (globalThis as any).Deno;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

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

  // 1) 워크스페이스 글로벌 토글
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

  // 2) 수신자 결정
  let candidateIds: string[] = body.target_user_ids?.length
    ? body.target_user_ids
    : await getRecipients(supabase, body.type, body.workspace_id);

  // 3) actor 본인 제외
  if (body.actor_id) candidateIds = candidateIds.filter((u) => u !== body.actor_id);
  if (!candidateIds.length) return json({ ok: true, sent: 0 });

  // 4) 개인 prefs 필터
  const { data: prefs } = await supabase
    .from("notification_prefs")
    .select("user_id, enabled, preferences")
    .in("user_id", candidateIds);
  // deno-lint-ignore no-explicit-any
  const prefsMap = new Map((prefs ?? []).map((p: any) => [p.user_id, p]));

  const finalIds = candidateIds.filter((uid) => {
    const p = prefsMap.get(uid);
    if (!p) return true;                 // 설정 row 없음 → 기본 받음
    if (p.enabled === false) return false; // 마스터 OFF
    const t = p.preferences?.[body.type];
    return t === undefined ? true : t === true;
  });
  if (!finalIds.length) return json({ ok: true, sent: 0 });

  // 5) 발송
  const payload: PushPayload = {
    title: body.title,
    body: body.body,
    url: body.url,
    tag: body.tag,
  };
  await sendPushToUsers(supabase, finalIds, payload);

  return json({ ok: true, sent: finalIds.length });
});

/** target_user_ids 가 없을 때의 기본 수신자 규칙 */
async function getRecipients(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  type: EventType,
  workspaceId: string,
): Promise<string[]> {
  switch (type) {
    // 운영자 전용 알림
    case "attendance_reported": {
      const { data } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .in("role", ["owner", "admin"]);
      return (data ?? []).map((r: { user_id: string }) => r.user_id);
    }
    // 기본: 전체 active 멤버 (guest 제외)
    default: {
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
```

### 5.2 `supabase/functions/_shared/push.ts` — VAPID + aes128gcm 직접 구현

`web-push` npm 패키지는 Deno Edge Runtime 에서 안 돈다. WebCrypto 로 직접 구현한 버전
(RFC 8188 / 8291 준수). **그대로 복사해서 쓰면 된다.**

```ts
// ============================================================
// Web Push 송신 모듈 (Supabase Edge Function / Deno)
// secrets: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
// ============================================================

function base64urlEncode(data: Uint8Array): string {
  // deno-lint-ignore no-explicit-any
  return btoa(String.fromCharCode.apply(null, Array.from(data) as any))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const padding = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
}

// ---- VAPID JWT (ES256) ----
async function createVapidJwt(
  audience: string, subject: string, publicKey: string, privateKey: string,
): Promise<string> {
  const header = base64urlEncode(
    new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })),
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = base64urlEncode(
    new TextEncoder().encode(
      JSON.stringify({ aud: audience, exp: now + 12 * 3600, sub: subject }),
    ),
  );
  const unsigned = `${header}.${payload}`;

  const pubBytes = base64urlDecode(publicKey);
  const privBytes = base64urlDecode(privateKey);
  const jwk = {
    kty: "EC", crv: "P-256",
    x: base64urlEncode(pubBytes.slice(1, 33)),
    y: base64urlEncode(pubBytes.slice(33, 65)),
    d: base64urlEncode(privBytes),
  };
  const key = await crypto.subtle.importKey(
    "jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${base64urlEncode(new Uint8Array(sig))}`;
}

// ---- Payload 암호화 (aes128gcm) ----
async function encryptPayload(payload: string, p256dh: string, authSecret: string) {
  const clientPub = base64urlDecode(p256dh);
  const clientAuth = base64urlDecode(authSecret);

  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"],
  );
  const localPub = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey),
  );
  const clientKey = await crypto.subtle.importKey(
    "raw", clientPub, { name: "ECDH", namedCurve: "P-256" }, false, [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey }, localKeyPair.privateKey, 256,
    ),
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const authInfo = new Uint8Array([
    ...new TextEncoder().encode("WebPush: info\0"), ...clientPub, ...localPub,
  ]);
  const sharedKey = await crypto.subtle.importKey(
    "raw", shared, { name: "HKDF" }, false, ["deriveBits"],
  );
  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", salt: clientAuth, info: authInfo, hash: "SHA-256" },
      sharedKey, 256,
    ),
  );
  const ikmKey = await crypto.subtle.importKey(
    "raw", ikm, { name: "HKDF" }, false, ["deriveBits"],
  );
  const cek = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", salt,
        info: new TextEncoder().encode("Content-Encoding: aes128gcm\0"),
        hash: "SHA-256" }, ikmKey, 128,
    ),
  );
  const nonce = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", salt,
        info: new TextEncoder().encode("Content-Encoding: nonce\0"),
        hash: "SHA-256" }, ikmKey, 96,
    ),
  );
  const aesKey = await crypto.subtle.importKey(
    "raw", cek, { name: "AES-GCM" }, false, ["encrypt"],
  );
  // RFC 8188: padding delimiter(0x02) 는 끝에 붙는다
  const padded = new Uint8Array([...new TextEncoder().encode(payload), 2]);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded),
  );
  return { encrypted, salt, localPublicKey: localPub };
}

function buildBody(
  encrypted: Uint8Array, salt: Uint8Array, localPublicKey: Uint8Array, rs = 4096,
): Uint8Array {
  const header = new Uint8Array(16 + 4 + 1 + localPublicKey.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs);
  header[20] = localPublicKey.length;
  header.set(localPublicKey, 21);
  const body = new Uint8Array(header.length + encrypted.length);
  body.set(header);
  body.set(encrypted, header.length);
  return body;
}

export type Subscription = {
  id: string; user_id: string; endpoint: string; p256dh: string; auth: string;
};
export type PushPayload = {
  title: string; body: string; tag?: string; url?: string;
};

export async function sendPush(
  sub: Subscription, payload: PushPayload,
): Promise<{ ok: boolean; status?: number; gone?: boolean }> {
  // deno-lint-ignore no-explicit-any
  const env = (Deno as any).env;
  const VAPID_PUBLIC = env.get("VAPID_PUBLIC_KEY")!;
  const VAPID_PRIVATE = env.get("VAPID_PRIVATE_KEY")!;
  // ★ Apple 은 sub 가 mailto: / https: 로 시작하지 않으면 JWT 를 거부(BadJwtToken).
  //   안드로이드는 통과하는데 iOS 만 실패하는 전형적 원인.
  let VAPID_SUBJECT = env.get("VAPID_SUBJECT") || "mailto:owner@example.com";
  if (!/^(mailto:|https:\/\/)/.test(VAPID_SUBJECT)) {
    VAPID_SUBJECT = `mailto:${VAPID_SUBJECT}`;
  }
  const isApple = sub.endpoint.includes("push.apple.com");

  try {
    const audience = new URL(sub.endpoint).origin;
    const jwt = await createVapidJwt(audience, VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    const { encrypted, salt, localPublicKey } = await encryptPayload(
      JSON.stringify(payload), sub.p256dh, sub.auth,
    );
    const body = buildBody(encrypted, salt, localPublicKey);

    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC}`,
        TTL: "86400",
        // ★ iOS 는 normal 우선순위 푸시를 지연/병합/드롭한다.
        //   "갤럭시는 뜨는데 아이폰만 안 뜸" 의 주원인. high 로 보낸다.
        Urgency: "high",
      },
      body,
    });

    // 410 Gone / 404 = 만료된 구독 → 정리 대상
    if (res.status === 410 || res.status === 404) {
      return { ok: false, status: res.status, gone: true };
    }
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.text()).slice(0, 300); } catch { /* ignore */ }
      console.error(
        `[push] failed status=${res.status} apple=${isApple} detail=${detail}`,
      );
    }
    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.error("[push] sendPush error", err);
    return { ok: false };
  }
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export async function sendPushToUsers(
  supabase: SupabaseClient, userIds: string[], payload: PushPayload,
): Promise<void> {
  if (!userIds.length) return;

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (!subs?.length) return;

  const results = await Promise.allSettled(
    (subs as Subscription[]).map((s) => sendPush(s, payload)),
  );

  // 만료된 구독 자동 삭제 — 안 하면 죽은 endpoint 로 계속 쏜다
  const goneIds: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value.gone) {
      goneIds.push((subs as Subscription[])[i].id);
    }
  });
  if (goneIds.length) {
    await supabase.from("push_subscriptions").delete().in("id", goneIds);
  }
}
```

> **배포 주의** — `_shared/` 를 import 하는 함수는 Supabase 대시보드 UI 로 배포하면 실패한다.
> 반드시 CLI: `supabase functions deploy notify --project-ref <PROJECT_REF>`

---

## 6. 클라이언트 — Service Worker · 구독 · 설정 모듈

### 6.1 `public/sw.js` — Service Worker

```js
/* eslint-disable no-restricted-globals */
// Web Push 수신 + 클릭 핸들링. 캐싱은 하지 않는다(정적 호스팅 + 브라우저 캐시에 위임).

self.addEventListener("install", () => {
  self.skipWaiting();          // 새 SW 즉시 활성화
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());   // 기존 탭도 즉시 제어
});

// ============================================================
// 푸시 수신 — try/catch 필수 (payload 파싱 실패해도 알림은 떠야 함)
// ============================================================
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    console.error("[sw] push payload parse error", e);
    data = { title: "새 알림", body: "앱을 열어서 확인해 주세요." };
  }

  const title = data.title || "AI 오피스";
  const options = {
    body: data.body || "",
    icon: "/icon-192.svg",
    badge: "/icon-192.svg",
    tag: data.tag || "app-default",      // 같은 tag = 알림 대체(스택 방지)
    data: { url: data.url || "/dashboard" },
    requireInteraction: false,
  };

  // ★ waitUntil 로 감싸지 않으면 SW 가 먼저 죽어 알림이 안 뜬다
  event.waitUntil(self.registration.showNotification(title, options));
});

// ============================================================
// 알림 클릭 → 열려 있는 앱 포커스 + 해당 URL 로 이동
// ============================================================
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (new URL(client.url).origin === self.location.origin) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);   // 앱이 안 떠 있으면 새로 열기
      }),
  );
});
```

### 6.2 `public/manifest.webmanifest` — PWA (iOS 푸시의 전제 조건)

```json
{
  "name": "AI 오피스",
  "short_name": "오피스",
  "description": "회의 · 회의록 · 할일 · 문서를 한곳에.",
  "start_url": "/dashboard",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "lang": "ko",
  "icons": [
    { "src": "/icon-192.svg", "sizes": "192x192", "type": "image/svg+xml", "purpose": "any maskable" },
    { "src": "/icon-512.svg", "sizes": "512x512", "type": "image/svg+xml", "purpose": "any maskable" }
  ]
}
```

`index.html` 에 필요한 메타:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="theme-color" content="#ffffff" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/icon-192.svg" />
```

### 6.3 `src/lib/push.ts` — 구독 + 설정 클라이언트 모듈

```ts
import { supabase } from "@/lib/supabase";

/**
 * Web Push 클라이언트 모듈. Service Worker 는 public/sw.js.
 *
 * 흐름:
 *  1) 앱 부팅 시 registerServiceWorker()      (main.tsx)
 *  2) 사용자가 설정에서 "알림 켜기" → subscribePush()
 *  3) notification_prefs 토글로 종류별 ON/OFF
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function permissionState(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

let swReady = false;
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (swReady) return;
  swReady = true;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e) => {
      console.warn("[push] SW register failed", e);
    });
  });
}

export async function hasActiveSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

export async function subscribePush(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (!VAPID_PUBLIC_KEY) {
    console.warn("[push] VITE_VAPID_PUBLIC_KEY 가 비어있음");
    return false;
  }
  try {
    // ★ requestPermission 은 반드시 사용자 제스처(클릭) 안에서 호출
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return false;

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,        // 필수 — 무음 푸시는 브라우저가 거부
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
          .buffer as ArrayBuffer,
      });
    }
    const json = sub.toJSON();
    const endpoint = sub.endpoint;
    const p256dh = json.keys?.p256dh ?? "";
    const auth = json.keys?.auth ?? "";
    if (!endpoint || !p256dh || !auth) return false;

    const { error } = await supabase!
      .from("push_subscriptions")
      .upsert(
        { user_id: userId, endpoint, p256dh, auth },
        { onConflict: "user_id,endpoint" },   // 같은 기기 재구독은 갱신
      );
    return !error;
  } catch (e) {
    console.error("[push] subscribePush error", e);
    return false;
  }
}

export async function unsubscribePush(userId: string): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await supabase!
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch (e) {
    console.error("[push] unsubscribePush error", e);
  }
}

// ============================================================
// 알림 종류 정의 — 설정 화면이 이 배열을 그대로 렌더한다
// ============================================================
export const NOTIFICATION_TYPES = [
  { key: "member_joined",       label: "새 멤버 입장",  desc: "새 멤버가 합류했을 때" },
  { key: "new_meeting",         label: "새 회의 일정",  desc: "새 회의가 등록되었을 때" },
  { key: "attendance_reported", label: "지각·불참",     desc: "멤버가 지각 / 불참을 알렸을 때 (운영자만)" },
  { key: "new_note",            label: "새 회의록",     desc: "새 회의록이 작성되었을 때" },
  { key: "new_task",            label: "새 할일",       desc: "내가 담당으로 지정된 할일" },
  { key: "task_completed",      label: "할일 완료",     desc: "멤버가 할일을 완료했을 때" },
  { key: "new_agenda",          label: "새 안건·투표",  desc: "새 안건이 올라왔을 때" },
  { key: "new_post",            label: "새 글",         desc: "새 글이 공유되었을 때" },
  { key: "new_notice",          label: "새 공지",       desc: "새 공지사항이 올라왔을 때" },
  { key: "comment",             label: "댓글",          desc: "내 글 · 회의록 · 할일에 새 댓글" },
  { key: "like",                label: "좋아요",        desc: "내 글 · 할일에 좋아요" },
] as const;

export type NotificationTypeKey = (typeof NOTIFICATION_TYPES)[number]["key"];

export type NotificationPrefsRow = {
  user_id: string;
  enabled: boolean;
  preferences: Partial<Record<NotificationTypeKey, boolean>>;
  updated_at: string;
};

export async function getMyPrefs(userId: string): Promise<NotificationPrefsRow | null> {
  const { data } = await supabase!
    .from("notification_prefs").select("*").eq("user_id", userId).maybeSingle();
  return (data as NotificationPrefsRow | null) ?? null;
}

export async function saveMyPrefs(
  userId: string,
  patch: { enabled?: boolean; preferences?: Partial<Record<NotificationTypeKey, boolean>> },
): Promise<NotificationPrefsRow | null> {
  const { data } = await supabase!
    .from("notification_prefs")
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() },
            { onConflict: "user_id" })
    .select().single();
  return (data as NotificationPrefsRow | null) ?? null;
}

// ---- 운영자용 워크스페이스 글로벌 설정 ----
export type NotificationAdminRow = {
  workspace_id: string;
  enabled: Record<NotificationTypeKey, boolean>;
  updated_at: string;
};

export async function getAdminSettings(workspaceId: string) {
  const { data } = await supabase!
    .from("notification_admin").select("*")
    .eq("workspace_id", workspaceId).maybeSingle();
  return (data as NotificationAdminRow | null) ?? null;
}

export async function saveAdminSettings(
  workspaceId: string, enabled: Record<NotificationTypeKey, boolean>,
) {
  const { data } = await supabase!
    .from("notification_admin")
    .upsert({ workspace_id: workspaceId, enabled, updated_at: new Date().toISOString() },
            { onConflict: "workspace_id" })
    .select().single();
  return (data as NotificationAdminRow | null) ?? null;
}

// ============================================================
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}
```

### 6.4 앱 부팅에서 SW 등록 (`src/main.tsx`)

```tsx
import { registerServiceWorker } from "./lib/push";

registerServiceWorker();   // createRoot 전에 한 번

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
```

### 6.5 `src/lib/data/notify.ts` — 도메인에서 부르는 얇은 래퍼

```ts
import { supabase } from "@/lib/supabase";
import { getProfile } from "@/lib/data/profile";

/**
 * notify Edge Function 호출. best-effort — 실패해도 절대 throw 하지 않는다.
 * (알림 실패로 글 저장이 롤백되면 안 되므로)
 */
export async function notify(params: {
  type:
    | "member_joined" | "new_post" | "new_meeting" | "new_note"
    | "new_task" | "task_completed" | "new_agenda" | "new_notice"
    | "attendance_reported" | "comment" | "like";
  workspace_id: string;
  actor_id?: string | null;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  target_user_ids?: string[];
}): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.functions.invoke("notify", { body: params });
  } catch (e) {
    console.warn("[notify] invoke failed", e);
  }
}

/**
 * 답글 알림용 — 부모 댓글 작성자(user_id) 조회. 실패 시 null.
 * table 은 댓글 테이블명 (예: 'post_comments').
 */
export async function getParentCommentAuthor(
  table: string,
  parentId: string | null | undefined,
): Promise<string | null> {
  if (!parentId || !supabase) return null;
  try {
    const { data } = await supabase
      .from(table).select("user_id").eq("id", parentId).maybeSingle();
    return (data as { user_id?: string } | null)?.user_id ?? null;
  } catch {
    return null;
  }
}

/** 푸시 본문에 쓸 표시 이름. name → 이메일 로컬파트 → '누군가' */
export async function getActorName(userId: string | null | undefined): Promise<string> {
  if (!userId) return "누군가";
  try {
    const p = await getProfile(userId);
    if (!p) return "누군가";
    if (p.name && p.name.trim()) return p.name.trim();
    if (p.email) return p.email.split("@")[0];
    return "누군가";
  } catch {
    return "누군가";
  }
}
```

---

## 7. 데이터 레이어 — 좋아요/댓글/답글 + 알림 호출 패턴

한 자원(`post`)에 대한 **완전한 세트**. 다른 자원은 이름만 바꾸면 된다.

### 7.1 좋아요 상태 조회 + 토글

```ts
// src/lib/data/posts.ts
import { supabase } from "@/lib/supabase";
import { notify, getActorName, getParentCommentAuthor } from "@/lib/data/notify";
import { recordActivity } from "@/lib/data/activities";

/** 좋아요 수 + 내가 눌렀는지 — 한 번의 쿼리로 */
export async function getPostLikeState(
  postId: string, userId: string,
): Promise<{ count: number; liked: boolean }> {
  const { data } = await supabase!
    .from("post_likes").select("user_id").eq("post_id", postId);
  const rows = (data ?? []) as { user_id: string }[];
  return { count: rows.length, liked: rows.some((l) => l.user_id === userId) };
}

/**
 * 좋아요 토글.
 * ★ 트릭: 먼저 insert 를 시도하고, PK 중복 에러가 나면 그게 곧 "이미 눌렀다"
 *   → delete 로 전환. select→분기 보다 왕복이 한 번 적고 레이스에 강하다.
 */
export async function togglePostLike(
  postId: string, userId: string,
): Promise<boolean> {
  let liked = false;
  const { error } = await supabase!
    .from("post_likes").insert({ post_id: postId, user_id: userId });
  if (error) {
    await supabase!.from("post_likes").delete()
      .eq("post_id", postId).eq("user_id", userId);
    liked = false;
  } else {
    liked = true;
  }

  // ★ 켤 때만 알림 (끌 때는 조용히)
  if (liked) {
    const post = await getPost(postId);
    if (post) {
      await recordActivity({
        workspace_id: post.workspace_id,
        action: "liked_post",
        resource_type: "post",
        resource_id: post.id,
        metadata: { title: post.title },
      }, userId);

      if (post.user_id !== userId) {                 // 내 글에 내가 누른 건 제외
        const name = await getActorName(userId);
        await notify({
          type: "like",
          workspace_id: post.workspace_id,
          actor_id: userId,
          title: "👏 좋아요",
          body: `${name} 님이 「${post.title}」 글에 좋아요를 눌렀어요.`,
          url: `/posts/${post.id}`,
          tag: `post-like-${post.id}-${userId}`,     // 같은 사람 반복 토글 = 알림 1개
          target_user_ids: [post.user_id],           // 글쓴이에게만
        });
      }
    }
  }
  return liked;
}
```

### 7.2 댓글 목록 (작성자 조인)

```ts
export type PostCommentWithAuthor = PostComment & { author: AuthorRef | null };

export async function getPostComments(postId: string): Promise<PostCommentWithAuthor[]> {
  const { data } = await supabase!
    .from("post_comments")
    .select(
      // ★ FK 이름을 명시해야 조인이 모호해지지 않는다:
      //   <테이블>_<컬럼>_fkey
      "*, author:user_profiles!post_comments_user_id_fkey(user_id, name, email, avatar_url)",
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });   // 오름차순 — 답글 트리 구성이 쉬움
  return (data ?? []) as unknown as PostCommentWithAuthor[];
}
```

> 최상위/답글을 **한 번에 가져와** 클라이언트에서 `parent_id` 로 그룹핑한다.
> 댓글 수가 수천 개가 아니라면 이게 가장 단순하고 빠르다.

### 7.3 댓글 등록 — 댓글이면 글쓴이에게, 답글이면 부모 댓글 작성자에게

```ts
export async function addPostComment(
  postId: string,
  userId: string,
  content: string,
  parentId?: string | null,       // ★ 있으면 답글
): Promise<PostComment | null> {
  const { data } = await supabase!
    .from("post_comments")
    .insert({ post_id: postId, user_id: userId, content, parent_id: parentId ?? null })
    .select().single();
  const created = (data as PostComment | null) ?? null;
  if (!created) return null;

  const post = await getPost(postId);
  if (!post) return created;

  await recordActivity({
    workspace_id: post.workspace_id,
    action: "commented_post",
    resource_type: "post",
    resource_id: post.id,
    metadata: { title: post.title, excerpt: content.slice(0, 80) },
  }, userId);

  const name = await getActorName(userId);

  if (parentId) {
    // ─── 답글 → 부모 댓글 작성자에게만 ───
    const parentAuthor = await getParentCommentAuthor("post_comments", parentId);
    if (parentAuthor && parentAuthor !== userId) {
      await notify({
        type: "comment",
        workspace_id: post.workspace_id,
        actor_id: userId,
        title: "↳ 내 댓글에 답글",
        body: `${name} 님이 회원님의 댓글에 답글을 남겼어요: ${content.slice(0, 60)}`,
        url: `/posts/${post.id}`,
        tag: `post-reply-${created.id}`,
        target_user_ids: [parentAuthor],
      });
    }
  } else if (post.user_id !== userId) {
    // ─── 최상위 댓글 → 글쓴이에게만 ───
    await notify({
      type: "comment",
      workspace_id: post.workspace_id,
      actor_id: userId,
      title: "💬 글에 새 댓글",
      body: `${name} 님: ${content.slice(0, 80)}`,
      url: `/posts/${post.id}`,
      tag: `post-comment-${post.id}-${created.id}`,
      target_user_ids: [post.user_id],
    });
  }
  return created;
}

export async function deletePostComment(id: string): Promise<boolean> {
  const { error } = await supabase!.from("post_comments").delete().eq("id", id);
  return !error;   // RLS 가 "본인 or 운영자" 를 이미 검증
}
```

### 7.4 "누구에게 보낼까" 결정 규칙 (외우면 되는 3가지)

| 상황 | `target_user_ids` | 이유 |
| --- | --- | --- |
| 새 글 / 새 회의 / 새 회의록 / 새 안건 | **생략** → 전체 멤버 | 모두가 알아야 하는 일 |
| 댓글 · 좋아요 | `[글쓴이]` | 소음 최소화 |
| 답글 | `[부모 댓글 작성자]` | 스레드 당사자만 |
| 할일 배정 | `[담당자]` | 본인 일 |
| 할일 댓글/좋아요 | `[작성자, 담당자]` | 관련 2인 |
| 지각/불참 | 생략 (서버가 운영자로 한정) | 운영자만 필요 |

여러 명에게 보내되 본인은 빼야 할 때 쓰는 헬퍼:

```ts
/** 작성자 + 담당자 중 actor 본인과 null 을 제거 */
function taskNotifyTargets(
  task: { created_by: string; assignee_id: string | null },
  actorId: string,
): string[] {
  return [task.created_by, task.assignee_id].filter(
    (id): id is string => !!id && id !== actorId,
  );
}
```

---

## 8. 회의 메뉴 — 일정 · 참석 · 회의록 · 안건/투표

### 8.1 스키마

```sql
-- ─── 회의 일정 ────────────────────────────────────────────────
create table public.meetings (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title        text not null,
  description  text,
  location     text,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  agenda       text,
  content      text,                -- 회의 본문 (리치 에디터 JSON)
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index meetings_workspace_idx on public.meetings(workspace_id, starts_at desc);

-- ─── 참석 상태 ────────────────────────────────────────────────
create table public.meeting_attendees (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'attending'
    check (status in ('attending', 'absent', 'late')),
  reason     text,                  -- 지각/불참 사유
  primary key (meeting_id, user_id)
);

-- ─── 회의록 ───────────────────────────────────────────────────
create table public.meeting_notes (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  meeting_id   uuid references public.meetings(id) on delete set null,
  title        text not null,
  content      text,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─── 안건 + 투표 ──────────────────────────────────────────────
create table public.agendas (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.user_profiles(user_id) on delete cascade,
  title        text not null,
  description  text,
  poll_type    text not null check (poll_type in ('single', 'multi', 'text')),
  options      jsonb not null default '[]'::jsonb,  -- [{id, label}] / text 면 []
  deadline     timestamptz not null,
  closed_at    timestamptz,          -- 수동 마감 시에만 set
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.agenda_votes (
  id          uuid primary key default gen_random_uuid(),
  agenda_id   uuid not null references public.agendas(id) on delete cascade,
  user_id     uuid not null references public.user_profiles(user_id) on delete cascade,
  choices     text[] not null default '{}',    -- 선택한 option id 들
  text_answer text,                            -- 주관식 응답
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (agenda_id, user_id)                  -- ★ 1인 1표 (재투표는 upsert)
);

create table public.agenda_comments (
  id         uuid primary key default gen_random_uuid(),
  agenda_id  uuid not null references public.agendas(id) on delete cascade,
  user_id    uuid not null references public.user_profiles(user_id) on delete cascade,
  content    text not null,
  parent_id  uuid references public.agenda_comments(id) on delete cascade,
  created_at timestamptz not null default now()
);
```

> 마감은 **application-level** 로 판단한다 (`closed_at ?? deadline` 과 현재 시각 비교).
> DB 트리거로 잠그면 마감 연장이 번거로워진다.

### 8.2 회의 등록 → 전체 멤버 알림

```ts
export async function createMeeting(
  input: MeetingInput, createdBy: string, attendeeIds: string[] = [],
): Promise<Meeting | null> {
  const { data, error } = await supabase!
    .from("meetings").insert({ ...input, created_by: createdBy }).select().single();
  if (error || !data) return null;

  if (attendeeIds.length > 0) {
    await supabase!.from("meeting_attendees").insert(
      attendeeIds.map((uid) => ({
        meeting_id: data.id, user_id: uid, status: "attending" as const,
      })),
    );
  }

  const creatorName = await getActorName(createdBy);
  await notify({
    type: "new_meeting",
    workspace_id: data.workspace_id,
    actor_id: createdBy,
    title: "📅 새 회의 일정",
    body: `${creatorName} 님이 「${data.title}」 일정을 등록했어요.`,
    url: `/meetings/${data.id}`,
    tag: `meeting-${data.id}`,
    // target 없음 → 전체 멤버
  });
  return data as Meeting;
}
```

### 8.3 지각 / 불참 보고 → 운영자에게만

```ts
export async function reportAttendance(
  meetingId: string, userId: string,
  status: "late" | "absent", reason?: string,
): Promise<void> {
  const normalizedReason = reason?.trim() || null;
  await supabase!.from("meeting_attendees").upsert(
    { meeting_id: meetingId, user_id: userId, status, reason: normalizedReason },
    { onConflict: "meeting_id,user_id" },
  );

  const meeting = await getMeeting(meetingId);
  if (!meeting) return;

  await recordActivity({
    workspace_id: meeting.workspace_id,
    action: status === "late" ? "reported_late" : "reported_absent",
    resource_type: "meeting",
    resource_id: meetingId,
    metadata: { title: meeting.title, reason: normalizedReason, starts_at: meeting.starts_at },
  }, userId);

  const name = await getActorName(userId);
  const verb = status === "late" ? "지각해요" : "참석 못 해요";
  await notify({
    type: "attendance_reported",
    workspace_id: meeting.workspace_id,
    actor_id: userId,
    title: status === "late" ? "⏰ 지각 알림" : "🙏 불참 알림",
    body: `${name} 님이 「${meeting.title}」 ${verb}${normalizedReason ? ` — ${normalizedReason}` : ""}`,
    url: `/meetings/${meeting.id}`,
    tag: `attendance-${meeting.id}-${userId}`,
    // target 없음 → Edge Function 의 getRecipients 가 운영자로 한정
  });
}
```

### 8.4 회의록 작성 → 전체 멤버 알림

```ts
export async function createNote(
  input: NoteInput, createdBy: string,
): Promise<MeetingNote | null> {
  const { data } = await supabase!
    .from("meeting_notes").insert({ ...input, created_by: createdBy })
    .select().single();
  if (data) {
    const name = await getActorName(createdBy);
    await notify({
      type: "new_note",
      workspace_id: data.workspace_id,
      actor_id: createdBy,
      title: "📝 새 회의록",
      body: `${name} 님이 「${data.title}」 회의록을 작성했어요.`,
      url: `/notes/${data.id}`,
      tag: `note-${data.id}`,
    });
  }
  return (data as MeetingNote | null) ?? null;
}
```

### 8.5 안건 등록 + 안건 댓글(★ 전체 발송 예외)

```ts
// 안건 등록 → 전체 멤버 (투표해야 하니까)
await notify({
  type: "new_agenda",
  workspace_id: created.workspace_id,
  actor_id: userId,
  title: "📋 새 안건",
  body: `${creatorName} 님이 「${created.title}」 안건을 올렸어요.`,
  url: `/agendas/${created.id}`,
  tag: `agenda-${created.id}`,
});

// 안건 댓글 → ★ 예외적으로 전체 멤버.
// 안건은 "토론" 이 목적이라 의견이 달리면 모두가 봐야 한다.
// (일반 글 댓글은 글쓴이에게만인 것과 대비)
await notify({
  type: "comment",
  workspace_id: a.workspace_id,
  actor_id: userId,
  title: "💬 안건에 새 의견",
  body: `${commenterName} 님: ${content.slice(0, 80)}`,
  url: `/agendas/${a.id}`,
  tag: `agenda-comment-${a.id}-${created.id}`,
});
```

### 8.6 (선택) 회의 시작 전 리마인더 — pg_cron

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 같은 이름 잡이 중복 등록되지 않게 항상 지우고 다시 건다 (멱등)
do $cleanup$
declare r record;
begin
  for r in select jobid from cron.job where jobname = 'meeting-reminder-hourly' loop
    perform cron.unschedule(r.jobid);
  end loop;
end
$cleanup$;

select cron.schedule(
  'meeting-reminder-hourly',
  '0 * * * *',                       -- 매시 정각
  $job$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/meeting-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>'   -- 게이트웨이 통과용. 함수는 service_role 로 동작
    ),
    body := '{}'::jsonb
  );
  $job$
);
```

`meeting-reminder` 함수는 "지금부터 1~2시간 뒤 시작하는 회의" 를 찾아 `sendPushToUsers` 를
호출하면 된다. 중복 발송은 `notification_log(user_id, type, ref_key)` 유니크 제약으로 막는다.

---

## 9. 할일 — 배정 · 재배정 · 완료 · 할일 소셜

### 9.1 스키마

```sql
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title        text not null,
  description  text,
  status       text not null default 'todo'
    check (status in ('todo', 'in_progress', 'done')),
  priority     text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  due_date     timestamptz,
  assignee_id  uuid references auth.users(id) on delete set null,  -- 담당자
  created_by   uuid not null references auth.users(id) on delete cascade,
  meeting_id   uuid references public.meetings(id) on delete set null,  -- 어느 회의에서 나온 할일인지
  note_id      uuid references public.meeting_notes(id) on delete set null,
  category     text,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index tasks_workspace_idx on public.tasks(workspace_id);
create index tasks_assignee_idx  on public.tasks(assignee_id);
```

> `meeting_id` / `note_id` 가 **회의 ↔ 할일 연결의 핵심**이다.
> 회의록 화면에서 "이 회의에서 나온 액션 아이템" 을 바로 만들고,
> 할일 상세에서 "↗ 회의록" 링크로 되돌아갈 수 있다.
> `on delete set null` 이라 회의록이 지워져도 할일은 살아남는다.

`task_likes` / `task_comments` 는 3.1 템플릿 그대로 (마이그 047 참고).

### 9.2 생성 시 배정 → 담당자에게만 알림

```ts
export async function createTask(
  input: TaskInput, createdBy: string,
): Promise<Task | null> {
  const { data } = await supabase!
    .from("tasks")
    .insert({
      workspace_id: input.workspace_id,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      due_date: input.due_date ?? null,
      assignee_id: input.assignee_id ?? null,
      created_by: createdBy,
      meeting_id: input.meeting_id ?? null,
      note_id: input.note_id ?? null,
      category: input.category ?? null,
    })
    .select().single();

  // 담당자에게만. 내가 나에게 만든 건 actor_id 가 같아 서버에서 자동 제외됨.
  if (data && (data as Task).assignee_id) {
    const t = data as Task;
    const name = await getActorName(createdBy);
    await notify({
      type: "new_task",
      workspace_id: t.workspace_id,
      actor_id: createdBy,
      title: "📝 새 할일",
      body: `${name} 님이 회원님께 「${t.title}」을 배정했어요.`,
      url: `/tasks/${t.id}`,
      tag: `task-${t.id}`,
      target_user_ids: [t.assignee_id!],
    });
  }
  return (data as Task | null) ?? null;
}
```

### 9.3 수정 — 완료 전환 + **재배정** 알림

밋업 현재 코드는 *완료 전환*만 알린다. 재배정 알림은 아래처럼 한 블록만 추가하면 된다.
(AI 오피스에는 처음부터 넣는 걸 권장 — "나한테 넘어온 일" 을 모르면 할일 앱의 의미가 없다.)

```ts
export type UpdateTaskOpts = {
  /** 명시적 actor. 없으면 담당자→작성자 순. '본인 제외' 처리에 필수 */
  actorId?: string;
};

export async function updateTask(
  id: string, patch: TaskPatch, opts?: UpdateTaskOpts,
): Promise<Task | null> {
  // ★ 변경 전 상태를 먼저 읽는다 (done 전환 / 담당자 변경 감지용)
  const { data: prev } = await supabase!
    .from("tasks").select("status, completed_at, assignee_id")
    .eq("id", id).maybeSingle();
  const wasDone = (prev as any)?.status === "done";
  const prevAssignee = (prev as any)?.assignee_id ?? null;

  // done 이 되면 completed_at 자동 기록, 풀리면 clear
  const finalPatch: TaskPatch = { ...patch };
  if (patch.status === "done" && !(prev as any)?.completed_at) {
    (finalPatch as any).completed_at = new Date().toISOString();
  } else if (patch.status && patch.status !== "done") {
    (finalPatch as any).completed_at = null;
  }

  const { data } = await supabase!
    .from("tasks").update(finalPatch).eq("id", id).select().single();
  const updated = (data as Task | null) ?? null;
  if (!updated) return null;

  const actor = opts?.actorId ?? updated.assignee_id ?? updated.created_by;

  // ─── ① 재배정 알림 (추가 권장) ───────────────────────────────
  if (
    Object.prototype.hasOwnProperty.call(patch, "assignee_id") &&
    updated.assignee_id &&
    updated.assignee_id !== prevAssignee
  ) {
    const name = await getActorName(actor);
    await notify({
      type: "new_task",
      workspace_id: updated.workspace_id,
      actor_id: actor,
      title: "🔄 할일 담당자 변경",
      body: `${name} 님이 「${updated.title}」을 회원님께 넘겼어요.`,
      url: `/tasks/${updated.id}`,
      tag: `task-assign-${updated.id}-${updated.assignee_id}`,
      target_user_ids: [updated.assignee_id],
    });
  }

  // ─── ② 완료 전환 → 전체 멤버 (본인 제외) ─────────────────────
  if (!wasDone && updated.status === "done") {
    await recordActivity({
      workspace_id: updated.workspace_id,
      action: "completed_task",
      resource_type: "task",
      resource_id: updated.id,
      metadata: { title: updated.title },
    }, actor);

    const name = await getActorName(actor);
    await notify({
      type: "task_completed",
      workspace_id: updated.workspace_id,
      actor_id: actor,
      title: "✅ 할일 완료",
      body: `${name} 님이 「${updated.title}」을 완료했어요.`,
      url: `/tasks/${updated.id}`,
      tag: `task-${updated.id}-done`,
    });
  }

  return updated;
}
```

> **`opts.actorId` 가 왜 필요한가** — 운영자가 남의 할일을 대신 완료 처리하면,
> actor 를 담당자로 잘못 잡을 경우 정작 담당자에게 알림이 안 간다.
> 화면에서 `updateTask(id, patch, { actorId: user.id })` 로 항상 넘겨주는 게 안전하다.

### 9.4 할일 좋아요 / 댓글 → 작성자 + 담당자

```ts
export async function toggleTaskLike(taskId: string, userId: string): Promise<boolean> {
  const { error } = await supabase!
    .from("task_likes").insert({ task_id: taskId, user_id: userId });
  if (error) {                       // 이미 눌러져 있음 → 토글 off
    await supabase!.from("task_likes").delete()
      .eq("task_id", taskId).eq("user_id", userId);
    return false;
  }

  const { data: task } = await supabase!
    .from("tasks").select("created_by, assignee_id, workspace_id, title")
    .eq("id", taskId).maybeSingle();
  if (task) {
    const t = task as { created_by: string; assignee_id: string | null;
                        workspace_id: string; title: string };
    const targets = taskNotifyTargets(t, userId);
    if (targets.length) {
      const name = await getActorName(userId);
      await notify({
        type: "like",
        workspace_id: t.workspace_id,
        actor_id: userId,
        title: "👏 좋아요",
        body: `${name} 님이 「${t.title}」 할일에 좋아요를 눌렀어요.`,
        url: `/tasks/${taskId}`,
        tag: `task-like-${taskId}-${userId}`,
        target_user_ids: targets,
      });
    }
  }
  return true;
}
```

할일 댓글도 동일 — 최상위 댓글은 `taskNotifyTargets(t, userId)`(작성자+담당자),
답글은 `getParentCommentAuthor("task_comments", parentId)` 한 명.
할일 좋아요는 실무적으로 **「확인했어요 / 응원」** 신호로 쓰인다.

---

## 10. UI / 디자인 코드 — 좋아요·댓글 블록

### 10.1 디자인 토큰 (Tailwind v4 / `src/index.css`)

무인양품 톤 — **순백 배경 · 그림자 없음 · 둥근 모서리 없음 · hairline 보더 · 절제된 색**.
색 액센트는 teal 하나로 통일한다.

```css
@import "tailwindcss";

:root {
  /* PWA safe area — 고정 헤더/하단바에 반드시 반영 */
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);

  --surface: #ffffff;
  --surface-muted: #f7f7f5;
  --foreground: #1a1a1a;
  --foreground-muted: #6b6b6b;
  --foreground-faint: #a1a1a1;
  --line: #e8e6e1;
  --line-strong: #c9c6bf;
  --accent: #1a1a1a;
  --accent-foreground: #ffffff;
  --accent-teal: #0a4145;     /* 유일한 컬러 액센트 */
  --accent-amber: #b5862c;    /* 지각 등 중간 상태 */
  --danger: #b54a3a;
  --danger-bg: #fbf1ef;
}

@theme inline {
  --spacing-safe-top: var(--safe-top);
  --spacing-safe-bottom: var(--safe-bottom);
  --color-surface: var(--surface);
  --color-surface-muted: var(--surface-muted);
  --color-foreground: var(--foreground);
  --color-foreground-muted: var(--foreground-muted);
  --color-foreground-faint: var(--foreground-faint);
  --color-line: var(--line);
  --color-line-strong: var(--line-strong);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent-teal: var(--accent-teal);
  --color-danger: var(--danger);
  --color-danger-bg: var(--danger-bg);
}

/* 섹션 레이블 — 트래킹 넓은 영문 대문자 */
.label {
  font-size: 0.6875rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--foreground-faint);
  font-weight: 500;
}
```

공용 클래스 상수 (`src/features/_shared.ts`):

```ts
export const inputClass =
  "w-full border-b border-line-strong px-0 py-2 text-sm focus:border-foreground focus:outline-none bg-transparent placeholder:text-foreground-faint";
export const labelClass = "text-xs text-foreground-muted";
export const primaryBtn =
  "w-full border border-accent bg-accent px-4 py-3 text-sm text-accent-foreground hover:bg-foreground-muted hover:border-foreground-muted transition disabled:opacity-50";
export const secondaryBtn =
  "w-full flex items-center justify-center gap-3 border border-line-strong bg-surface px-4 py-3 text-sm text-foreground hover:border-foreground transition disabled:opacity-60";
export const errorBox =
  "border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger";
```

### 10.2 화면 구조

```
┌──────────────────────────────────────────────┐
│ ── border-t border-line ──────────────────── │
│ [♥ 12]                        COMMENTS 5     │  ← 헤더: 좋아요 버튼 + 댓글 수
│                                              │
│ ⬤ 김대표  2026-08-17 14:02                   │
│   회의록 정리 감사합니다. 3번 항목만…         │
│                        [삭제] [답글]         │  ← 우하단 연한 박스 버튼
│ ─ border-b border-line/40 ─────────────────  │
│   ┏━ accent-teal/70 테두리 ━━━━━━━━━━━━━┓   │
│   ┃ ↳ ⬤ 박이사  14:20                  ┃   │  ← 답글: 연한 초록 콜아웃 + ↳
│   ┃   3번은 다음 회의로 넘길게요        ┃   │
│   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
│                                              │
│ [댓글을 남겨주세요...            ] [ 등록 ]  │  ← 자동 높이 textarea
└──────────────────────────────────────────────┘
```

디자인 결정 이유:
- **좋아요는 하트 문자(`♡`/`♥`) + 숫자** — 아이콘 라이브러리 의존 없음, 눌린 상태는 teal 보더로.
- **답글은 들여쓰기(`ml-8`) + 연한 teal 콜아웃** — 깊이 1단계만 허용해 스레드가 안 무너진다.
- **삭제/답글 버튼은 우하단 소형 박스** — 상시 노출(모바일엔 hover 가 없다).
- **`border-b border-line/40`** — 댓글 사이 구분선을 본문 hairline 보다 더 연하게.

### 10.3 `src/features/social/like-comment-block.tsx` — 전체 코드

```tsx
import {
  useEffect, useLayoutEffect, useRef, useState,
  type FormEvent, type ReactNode,
} from "react";
import { Avatar } from "@/components/avatar";
import { inputClass } from "@/features/_shared";
import { formatDateTime } from "@/lib/format";

/**
 * 한 줄에서 시작해 내용 줄 수만큼만 늘어나는 입력칸.
 * rows={2} 처럼 빈 줄 여백이 생기지 않도록 scrollHeight 로 높이를 맞춘다.
 */
function AutoTextarea({
  value, onChange, placeholder, className, autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const borders = el.offsetHeight - el.clientHeight;   // border-box 보정
    el.style.height = `${el.scrollHeight + borders}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={`${className ?? ""} resize-none overflow-hidden`}
    />
  );
}

type AuthorRef = {
  user_id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
};

export type CommentRow = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  /** 값이 있으면 그 댓글에 대한 답글 */
  parent_id?: string | null;
  author: AuthorRef | null;
};

type Props = {
  liked: boolean;
  likeCount: number;
  onToggleLike: () => Promise<void> | void;

  comments: CommentRow[];
  currentUserId: string;
  /** 운영자는 남의 댓글도 삭제 가능 */
  canModerate: boolean;
  /** parentId 가 있으면 답글로 저장 */
  onAddComment: (content: string, parentId?: string | null) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
};

// 우하단 액션 버튼 — 연한 네모박스 톤
const ACTION_BTN =
  "border border-accent-teal/40 bg-accent-teal/10 px-2.5 py-1 text-[11px] text-accent-teal/90 hover:bg-accent-teal/[0.18] hover:border-accent-teal/60 transition-colors";
const DELETE_BTN =
  "border border-line px-2.5 py-1 text-[11px] text-foreground-faint hover:text-danger hover:border-danger/50 transition-colors";

/**
 * 좋아요 + 댓글(+답글) 통합 블록 — 글/회의록/안건/할일 상세 공용.
 */
export function LikeCommentBlock({
  liked, likeCount, onToggleLike,
  comments, currentUserId, canModerate, onAddComment, onDeleteComment,
}: Props) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  // ★ 좋아요 낙관적 업데이트 — 클릭 즉시 UI 반영, 서버는 뒤따른다.
  //   (서버 왕복 + refetch 를 기다리면 느리고, 빠른 더블클릭 시 토글이
  //    두 번 돌아 되돌아가는 문제가 생긴다)
  const [optimisticLiked, setOptimisticLiked] = useState(liked);
  const [optimisticCount, setOptimisticCount] = useState(likeCount);
  const likePending = useRef(false);

  // 부모(refetch)가 새 값을 주면 동기화 — 단, 인플라이트 중엔 덮어쓰지 않음
  useEffect(() => {
    if (likePending.current) return;
    setOptimisticLiked(liked);
    setOptimisticCount(likeCount);
  }, [liked, likeCount]);

  async function handleToggleLike() {
    if (likePending.current) return;          // 중복 클릭 차단
    likePending.current = true;
    const next = !optimisticLiked;
    setOptimisticLiked(next);
    setOptimisticCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      await onToggleLike();
    } catch {
      setOptimisticLiked(!next);              // 실패 시 롤백
      setOptimisticCount((c) => Math.max(0, c + (next ? -1 : 1)));
    } finally {
      likePending.current = false;
    }
  }

  // 최상위 / 답글 그룹핑
  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesByParent = new Map<string, CommentRow[]>();
  for (const c of comments) {
    if (!c.parent_id) continue;
    const arr = repliesByParent.get(c.parent_id) ?? [];
    arr.push(c);
    repliesByParent.set(c.parent_id, arr);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    setBusy(true);
    await onAddComment(t);
    setDraft("");
    setBusy(false);
  }

  return (
    <section className="border-t border-line pt-6 space-y-6">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleToggleLike}
          className={`flex items-center gap-2 border px-3 py-1.5 text-sm transition-colors ${
            optimisticLiked
              ? "border-accent-teal text-accent-teal"
              : "border-line-strong text-foreground-muted hover:border-foreground hover:text-foreground"
          }`}
          aria-pressed={optimisticLiked}
        >
          <span>{optimisticLiked ? "♥" : "♡"}</span>
          <span>{optimisticCount}</span>
        </button>
        <p className="label">댓글 {comments.length}</p>
      </header>

      {topLevel.length > 0 && (
        <ul>
          {topLevel.map((c) => (
            <CommentThread
              key={c.id}
              comment={c}
              replies={repliesByParent.get(c.id) ?? []}
              currentUserId={currentUserId}
              canModerate={canModerate}
              onAddReply={(content) => onAddComment(content, c.id)}
              onDeleteComment={onDeleteComment}
            />
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <AutoTextarea
          value={draft}
          onChange={setDraft}
          placeholder={
            topLevel.length === 0
              ? "첫 댓글을 남겨주세요. 한줄평도 좋아요."
              : "댓글을 남겨주세요."
          }
          className={`${inputClass} flex-1`}
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="bg-accent-teal text-accent-foreground px-4 py-2 text-xs hover:bg-accent-teal/85 transition-colors disabled:opacity-60 sm:self-end shrink-0"
        >
          {busy ? "저장 중..." : "등록"}
        </button>
      </form>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────
// CommentThread — 최상위 댓글 1개 + 답글들 + 답글 입력
// ───────────────────────────────────────────────────────────────
function CommentThread({
  comment, replies, currentUserId, canModerate, onAddReply, onDeleteComment,
}: {
  comment: CommentRow;
  replies: CommentRow[];
  currentUserId: string;
  canModerate: boolean;
  onAddReply: (content: string) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
}) {
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const canDelete = comment.user_id === currentUserId || canModerate;

  async function handleDelete(id: string) {
    if (!confirm("이 댓글을 삭제하시겠습니까?")) return;
    await onDeleteComment(id);
  }

  async function submitReply(e: FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    setBusy(true);
    await onAddReply(t);
    setDraft("");
    setBusy(false);
    setReplying(false);
  }

  return (
    <li className="py-5 border-b border-line/40 last:border-b-0 first:pt-0">
      <CommentBody
        comment={comment}
        action={
          <div className="flex items-center gap-1.5">
            {canDelete && (
              <button type="button" onClick={() => handleDelete(comment.id)} className={DELETE_BTN}>
                삭제
              </button>
            )}
            <button type="button" onClick={() => setReplying((v) => !v)} className={ACTION_BTN}>
              {replying ? "취소" : "답글"}
            </button>
          </div>
        }
      />

      {/* 답글 — 연한 초록 콜아웃 + ↳ 화살표 */}
      {replies.length > 0 && (
        <ul className="mt-3 space-y-2">
          {replies.map((r) => {
            const canDeleteReply = r.user_id === currentUserId || canModerate;
            return (
              <li key={r.id} className="ml-8 border border-accent-teal/70 bg-accent-teal/[0.05] px-3 py-2">
                <CommentBody
                  comment={r}
                  isReply
                  action={
                    canDeleteReply ? (
                      <button type="button" onClick={() => handleDelete(r.id)} className={DELETE_BTN}>
                        삭제
                      </button>
                    ) : null
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      {replying && (
        <form onSubmit={submitReply} className="mt-2 ml-8 space-y-2">
          <AutoTextarea
            value={draft}
            onChange={setDraft}
            autoFocus
            placeholder="답글을 남겨주세요."
            className={inputClass}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="bg-accent-teal text-accent-foreground px-4 py-2 text-xs hover:bg-accent-teal/85 transition-colors disabled:opacity-60 shrink-0"
            >
              {busy ? "저장 중..." : "답글 등록"}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

// ───────────────────────────────────────────────────────────────
// CommentBody — 댓글/답글 공용 본문
// ───────────────────────────────────────────────────────────────
function CommentBody({
  comment, isReply = false, action,
}: {
  comment: CommentRow;
  isReply?: boolean;
  action?: ReactNode;
}) {
  const display = comment.author?.name ?? comment.author?.email ?? "익명";
  return (
    <div className={`flex gap-2.5 ${isReply ? "items-center" : ""}`}>
      {isReply && <ReplyArrow className="w-4 h-4 shrink-0 text-accent-teal" />}
      <Avatar url={comment.author?.avatar_url ?? null} name={display} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-sm">{display}</p>
          <span className="text-xs text-foreground-faint">
            {formatDateTime(comment.created_at)}
          </span>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-[1.85] text-foreground">
          {comment.content}
        </p>
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/** ↳ 오른쪽 아래로 꺾인 화살표 (답글 표시) */
function ReplyArrow({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}
         fill="none" stroke="currentColor" strokeWidth="1.7"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 5v6a2 2 0 002 2h7" />
      <path d="M14 10l3.5 3.5L14 17" />
    </svg>
  );
}
```

### 10.4 상세 페이지에서 붙이는 법 (10줄)

```tsx
const [refreshKey, setRefreshKey] = useState(0);

const { data: comments }  = useAsync(() => getPostComments(id), [id, refreshKey]);
const { data: likeState } = useAsync(
  () => getPostLikeState(id, user.id), [id, user.id, refreshKey],
);
const { data: myRole } = useAsync(
  () => getMyRole(workspace.id, user.id), [workspace?.id, user?.id],
);

<LikeCommentBlock
  liked={likeState?.liked ?? false}
  likeCount={likeState?.count ?? 0}
  onToggleLike={async () => {
    await togglePostLike(post.id, user.id);
    setRefreshKey((v) => v + 1);
  }}
  comments={comments ?? []}
  currentUserId={user.id}
  canModerate={myRole === "owner" || myRole === "admin"}
  onAddComment={async (content, parentId) => {
    await addPostComment(post.id, user.id, content, parentId);
    setRefreshKey((v) => v + 1);
  }}
  onDeleteComment={async (cid) => {
    await deletePostComment(cid);
    setRefreshKey((v) => v + 1);
  }}
/>
```

`refreshKey` 한 개로 좋아요/댓글을 함께 재조회한다. 좋아요는 컴포넌트 내부 낙관적
업데이트가 있으므로 refetch 지연이 체감되지 않는다.

### 10.5 할일 행 — 배정 표시 디자인

```tsx
export function TaskRow({ task, members, onToggle, noteLink }: Props) {
  const done = task.status === "done";
  const assignee = members.find((m) => m.user_id === task.assignee_id);
  const assigneeName = assignee?.profile.name ?? assignee?.profile.email ?? null;
  const overdue = !done && task.due_date && new Date(task.due_date).getTime() < Date.now();

  return (
    <li>
      <Link
        to={`/tasks/${task.id}`}
        className={`block py-4 -mx-2 px-2 hover:bg-surface-muted transition-colors ${
          done ? "bg-surface-muted" : ""
        }`}
      >
        <div className="flex items-start gap-3 sm:items-center">
          {/* 체크박스 — 직사각형, 완료 시 teal 채움. 링크 안이라 이벤트 전파 차단 필수 */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onToggle) void onToggle(done ? "todo" : "done");
            }}
            disabled={!onToggle}
            aria-label={done ? "미완료로 표시" : "완료로 표시"}
            className={`size-5 mt-0.5 sm:mt-0 shrink-0 border flex items-center justify-center transition-colors ${
              done
                ? "border-accent-teal bg-accent-teal text-accent-foreground"
                : "border-line-strong hover:border-foreground"
            }`}
          >
            {done && <span className="text-xs leading-none">✓</span>}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className={`text-sm min-w-0 truncate max-w-full ${
                done ? "line-through text-foreground-faint" : "text-foreground"
              }`}>
                {task.title}
              </p>
              {noteLink && (
                <Link to={noteLink} onClick={(e) => e.stopPropagation()}
                      className="shrink-0 text-xs text-foreground-faint hover:text-accent-teal">
                  ↗ 회의록
                </Link>
              )}
            </div>

            {/* 모바일: 담당자·기한을 아래 줄에 / 데스크탑: 우측 컬럼에 */}
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-foreground-muted sm:hidden">
              <span className="inline-flex items-center gap-1">
                담당 ·
                {assigneeName ? (
                  <>
                    <Avatar url={assignee?.profile.avatar_url ?? null}
                            name={assigneeName} size="xs" />
                    {assigneeName}
                  </>
                ) : "미지정"}
              </span>
              {task.due_date && (
                <span className={overdue ? "text-danger" : undefined}>
                  기한 · {formatShortDate(task.due_date)}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}
```

담당자 선택은 평범한 `<select>` 로 충분하다 (모바일에서 네이티브 피커가 뜨는 게 제일 편하다):

```tsx
<div>
  <label className={labelClass}>담당자</label>
  <select
    value={assigneeId ?? ""}
    onChange={(e) => setAssigneeId(e.target.value || null)}
    className={`${inputClass} mt-2`}
  >
    <option value="">미지정</option>
    {members.map((m) => (
      <option key={m.user_id} value={m.user_id}>
        {m.profile.name ?? m.profile.email}
      </option>
    ))}
  </select>
</div>
```

---

## 11. UI / 디자인 코드 — 알림 설정 화면

프로필/설정 페이지에 넣는 섹션. **마스터 스위치 + 테스트 발송 + 종류별 토글** 3단 구성.
테스트 발송 버튼이 있으면 "알림이 안 와요" 문의의 90%를 사용자가 스스로 진단한다.

```tsx
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { useAsync } from "@/lib/use-async";
import {
  NOTIFICATION_TYPES, type NotificationTypeKey,
  getMyPrefs, hasActiveSubscription, isPushSupported, permissionState,
  saveMyPrefs, subscribePush, unsubscribePush,
} from "@/lib/push";
import { notify } from "@/lib/data/notify";

export function NotificationSection() {
  const { user } = useAuth();
  const { workspace } = useActiveWorkspace();
  const supported = isPushSupported();
  const [perm, setPerm] = useState(permissionState());
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: prefs } = useAsync(
    () => (user ? getMyPrefs(user.id) : Promise.resolve(null)),
    [user?.id, refreshKey],
  );

  useEffect(() => {
    let cancelled = false;
    hasActiveSubscription().then((v) => { if (!cancelled) setSubscribed(v); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (!user) return null;

  async function handleEnable() {
    setBusy(true);
    const ok = await subscribePush(user!.id);
    if (ok) {
      await saveMyPrefs(user!.id, { enabled: true });
      setSubscribed(true);
      setPerm("granted");
    } else {
      alert(
        "알림 권한을 허용해주세요.\niOS: 홈 화면에 추가한 PWA 에서만 동작합니다.",
      );
    }
    setBusy(false);
    setRefreshKey((v) => v + 1);
  }

  async function handleDisable() {
    setBusy(true);
    await unsubscribePush(user!.id);
    await saveMyPrefs(user!.id, { enabled: false });
    setSubscribed(false);
    setBusy(false);
    setRefreshKey((v) => v + 1);
  }

  async function handleToggleType(key: NotificationTypeKey, value: boolean) {
    const next = { ...((prefs?.preferences ?? {}) as Record<string, boolean>), [key]: value };
    await saveMyPrefs(user!.id, { preferences: next });
    setRefreshKey((v) => v + 1);
  }

  async function handleTestNotification() {
    if (!workspace) return;
    setTestStatus("보내는 중...");
    // ★ actor_id 를 안 넘겨야 self-filter 를 피해 본인도 받는다
    await notify({
      type: "member_joined",
      workspace_id: workspace.id,
      title: "🔔 테스트 알림",
      body: "푸시 알림이 잘 도착하면 성공!",
      url: "/profile",
      tag: `test-${Date.now()}`,
      target_user_ids: [user!.id],
    });
    setTestStatus("전송 완료 — 몇 초 안에 알림이 도착할 거예요.");
    setTimeout(() => setTestStatus(null), 6000);
  }

  const masterOn = subscribed && (prefs?.enabled ?? true);

  return (
    <section>
      <h2 className="label mb-3">알림</h2>

      {!supported && (
        <p className="text-xs text-foreground-faint border-y border-line py-4">
          이 브라우저는 푸시 알림을 지원하지 않습니다. iOS 는 16.4+ 의
          홈 화면에 추가된 PWA 에서만 동작합니다.
        </p>
      )}

      {supported && (
        <div className="border-y border-line divide-y divide-line">
          <Row
            label="푸시 알림"
            desc={masterOn
              ? "활성화됨 — 종류별로 아래에서 세부 조정"
              : "꺼져있음 — 알림 받으려면 켜주세요"}
            right={masterOn ? (
              <button type="button" onClick={handleDisable} disabled={busy}
                className="text-xs text-foreground-muted hover:text-danger border border-line-strong px-3 py-1.5 hover:border-danger disabled:opacity-60">
                알림 끄기
              </button>
            ) : (
              <button type="button" onClick={handleEnable} disabled={busy || perm === "denied"}
                className="text-xs bg-accent-teal text-accent-foreground px-3 py-1.5 hover:bg-accent-teal/85 disabled:opacity-60">
                {busy ? "설정 중..." : "알림 켜기"}
              </button>
            )}
          />

          {masterOn && (
            <Row
              label="테스트 알림 보내기"
              desc={testStatus ??
                "본인에게 한 번 전송 — 도착 안 하면 권한 / VAPID 키 / SW 등록 점검"}
              right={
                <button type="button" onClick={handleTestNotification} disabled={busy}
                  className="text-xs border border-line-strong px-3 py-1.5 hover:border-foreground">
                  보내기
                </button>
              }
            />
          )}

          {masterOn && NOTIFICATION_TYPES.map((t) => (
            <Row
              key={t.key}
              label={t.label}
              desc={t.desc}
              right={
                <ToggleSwitch
                  checked={(prefs?.preferences?.[t.key] ?? true) === true}
                  onChange={(v) => handleToggleType(t.key, v)}
                />
              }
            />
          ))}
        </div>
      )}

      {perm === "denied" && (
        <p className="mt-3 text-xs text-danger">
          브라우저에서 알림 권한이 차단되어 있습니다. 설정에서 다시 허용해 주세요.
        </p>
      )}
    </section>
  );
}

function Row({ label, desc, right }: {
  label: string; desc?: string; right?: React.ReactNode;
}) {
  return (
    <div className="py-4 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm">{label}</p>
        {desc && <p className="text-xs text-foreground-muted mt-0.5">{desc}</p>}
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

/** 직사각형 토글 — 둥근 모서리 없이도 스위치로 읽힌다 */
function ToggleSwitch({ checked, onChange }: {
  checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 transition-colors ${
        checked ? "bg-accent-teal" : "bg-line-strong"
      }`}
    >
      <span aria-hidden
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-surface transition-transform ${
          checked ? "translate-x-4" : ""
        }`}
      />
    </button>
  );
}
```

운영자용 글로벌 설정 화면은 동일 구조에서 `getAdminSettings` / `saveAdminSettings` 만
바꿔 끼우면 된다 (`enabled` 전체 객체를 upsert).

---

## 12. 알림 종류 매트릭스 (누가 · 언제 · 누구에게)

| type | 트리거 | 수신자 | title / body 예시 | tag |
| --- | --- | --- | --- | --- |
| `member_joined` | 새 멤버 합류 | 전체 멤버 | `👋 새 멤버` / `○○ 님이 합류했어요.` | `member-<uid>` |
| `new_meeting` | 회의 일정 등록 | 전체 멤버 | `📅 새 회의 일정` / `○○ 님이 「제목」 일정을 등록했어요.` | `meeting-<id>` |
| `attendance_reported` | 지각·불참 보고 | **운영자** | `⏰ 지각 알림` / `○○ 님이 「제목」 지각해요 — 사유` | `attendance-<mid>-<uid>` |
| `new_note` | 회의록 작성 | 전체 멤버 | `📝 새 회의록` / `○○ 님이 「제목」 회의록을 작성했어요.` | `note-<id>` |
| `new_task` | 할일 배정 / 재배정 | **담당자** | `📝 새 할일` / `○○ 님이 회원님께 「제목」을 배정했어요.` | `task-<id>` |
| `task_completed` | 할일 done 전환 | 전체 멤버 | `✅ 할일 완료` / `○○ 님이 「제목」을 완료했어요.` | `task-<id>-done` |
| `new_agenda` | 안건 등록 | 전체 멤버 | `📋 새 안건` / `○○ 님이 「제목」 안건을 올렸어요.` | `agenda-<id>` |
| `new_post` | 글 발행(공개) | 전체 멤버 | `✍️ 새 글` / `○○ 님이 「제목」 글을 발행했어요.` | `post-<id>` |
| `new_notice` | 공지 등록 | 전체 멤버 | `📢 새 공지` / `제목` | `notice-<id>` |
| `comment` | 글·회의록·할일 댓글 | **글쓴이** (할일은 작성자+담당자) | `💬 글에 새 댓글` / `○○ 님: 내용 80자` | `post-comment-<pid>-<cid>` |
| `comment` | **안건** 댓글 | 전체 멤버 (예외) | `💬 안건에 새 의견` / `○○ 님: 내용` | `agenda-comment-<aid>-<cid>` |
| `comment` | 답글 | **부모 댓글 작성자** | `↳ 내 댓글에 답글` / `○○ 님이 회원님의 댓글에 답글을…` | `post-reply-<cid>` |
| `like` | 좋아요 켤 때 | **글쓴이** (할일은 작성자+담당자) | `👏 좋아요` / `○○ 님이 「제목」에 좋아요를 눌렀어요.` | `post-like-<pid>-<uid>` |

### 12.1 필터가 적용되는 순서 (중요)

```
notify() 호출
  → ① notification_admin.enabled[type] 이 false 면 즉시 중단 (운영자 글로벌 OFF)
  → ② target_user_ids 있으면 그 목록, 없으면 getRecipients(type) 기본 규칙
  → ③ actor_id 제거 (본인 제외)
  → ④ notification_prefs.enabled === false 인 사람 제거 (개인 마스터 OFF)
  → ⑤ notification_prefs.preferences[type] === false 인 사람 제거
  → ⑥ push_subscriptions 에 기기가 등록된 사람에게만 실제 발송
```

키가 아예 없으면 **항상 "받음"** 으로 해석한다 (새 알림 종류를 추가해도 기존 사용자가
자동으로 받게 됨). 조용히 시작하고 싶은 종류는 `notification_admin` 기본값을 `false` 로.

### 12.2 `tag` 작명 규칙

`<자원>-<동작>-<자원id>[-<구분자>]`

- 같은 tag = 잠금화면에서 **기존 알림을 대체**한다.
- 좋아요는 `-<userId>` 를 붙여 사람별로 1개 (같은 사람이 껐다 켜도 1개).
- 댓글은 `-<commentId>` 를 붙여 댓글마다 별개 (대체되면 안 되니까).
- 할일 완료는 `task-<id>-done` — 배정 알림(`task-<id>`)과 겹치지 않게 접미사.

---

## 13. 셋업 체크리스트 (VAPID → 배포까지)

### 13.1 VAPID 키 생성

```bash
npx web-push generate-vapid-keys
# =======================================
# Public Key:  BEl62iUYgUiv... (87자)
# Private Key: 8I1nR2fT...     (43자)
# =======================================
```

### 13.2 환경변수 / 시크릿

| 위치 | 키 | 값 |
| --- | --- | --- |
| `.env.local` (+ 배포 Secrets) | `VITE_SUPABASE_URL` | 프로젝트 URL |
| | `VITE_SUPABASE_ANON_KEY` | anon key |
| | `VITE_VAPID_PUBLIC_KEY` | **Public Key** |
| Supabase Function Secrets | `VAPID_PUBLIC_KEY` | 동일한 Public Key |
| | `VAPID_PRIVATE_KEY` | Private Key |
| | `VAPID_SUBJECT` | `mailto:owner@example.com` (★ `mailto:` 필수) |

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY="BEl62..." \
  VAPID_PRIVATE_KEY="8I1nR..." \
  VAPID_SUBJECT="mailto:owner@example.com" \
  --project-ref <PROJECT_REF>
```

> `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 는 Edge Function 런타임이 자동 주입한다.

### 13.3 순서대로 실행

- [ ] 1. 마이그레이션 적용 — 소셜 테이블(3장) → 알림 인프라(4장) → `handle_new_user` 갱신
- [ ] 2. `notify pgrst, 'reload schema';` 실행 (안 하면 새 테이블이 404)
- [ ] 3. `public/sw.js` · `public/manifest.webmanifest` · 아이콘(192/512) 추가
- [ ] 4. `index.html` 에 manifest / viewport-fit / apple-mobile-web-app-capable 메타
- [ ] 5. `src/lib/push.ts` · `src/lib/data/notify.ts` 추가, `main.tsx` 에서 `registerServiceWorker()`
- [ ] 6. Edge Function 배포 — **CLI 필수** (`_shared` import 때문에 대시보드 배포 실패)
      `supabase functions deploy notify --project-ref <PROJECT_REF>`
- [ ] 7. 설정 화면에 `<NotificationSection />` 배치
- [ ] 8. HTTPS 로 접속 → "알림 켜기" → **테스트 알림 보내기** 로 확인
- [ ] 9. 도메인 함수마다 `notify()` 호출 삽입 (7~9장 패턴)
- [ ] 10. iOS 기기: Safari → 공유 → **홈 화면에 추가** → PWA 에서 다시 알림 켜기

### 13.4 디버깅 순서

| 증상 | 확인 |
| --- | --- |
| 구독 자체가 안 됨 | HTTPS 인가 / `VITE_VAPID_PUBLIC_KEY` 비었는지 / SW 등록됐는지(DevTools → Application → Service Workers) |
| 구독은 됐는데 안 옴 | Function 로그 (`supabase functions logs notify`) 에서 `sent: 0` 인지 → 0이면 prefs/admin 토글 문제 |
| `sent: N` 인데 안 옴 | `[push] failed status=...` 로그 확인. 400 BadJwtToken → `VAPID_SUBJECT` 형식, 403 → VAPID 키 불일치 |
| 안드로이드만 옴, iOS 안 옴 | 홈 화면 추가한 PWA 인지 / `Urgency: high` 헤더 있는지 / VAPID subject 가 `mailto:` 인지 |
| 예전엔 왔는데 갑자기 끊김 | 구독 만료(410). `sendPushToUsers` 가 자동 삭제했을 것 — 앱에서 다시 "알림 켜기" |
| 새 테이블이 404 | `notify pgrst, 'reload schema';` 안 돌림 |
| 댓글 insert 가 403 | RLS `with check` 에서 `user_id = auth.uid()` 인지, 멤버십 헬퍼가 `security definer` 인지 |

---

## 14. iOS / Android 실전 함정

1. **iOS 는 홈 화면 추가한 PWA 에서만 푸시가 온다** (iOS 16.4+). Safari 탭에서는 구독 자체가 실패한다.
   설정 화면 안내 문구에 이걸 반드시 써 둘 것.
2. **`Urgency: high` 를 안 보내면 iOS 는 알림을 지연·병합·드롭한다.** "갤럭시는 잘 오는데
   아이폰만 안 와요" 의 1순위 원인. `userVisibleOnly: true` 로 구독하므로 high 가 정당하다.
3. **VAPID `sub` 는 `mailto:` 또는 `https://` 로 시작해야 한다.** Apple 만 엄격하게 검사해
   `BadJwtToken` 으로 400 을 준다. 코드에서 강제로 붙이는 방어 로직을 넣어뒀다.
4. **`Notification.requestPermission()` 은 사용자 클릭 안에서 호출.** 페이지 로드 직후
   자동 호출하면 브라우저가 무시하거나 영구 차단으로 처리한다.
5. **410 Gone 구독은 즉시 삭제.** 안 하면 죽은 endpoint 로 계속 쏘느라 발송이 느려진다.
6. **`event.waitUntil()` 로 감싸지 않으면** SW 가 먼저 종료돼 알림이 안 뜬다 (push / notificationclick 둘 다).
7. **payload 파싱은 반드시 try/catch.** 파싱이 터지면 알림 자체가 사라진다 — fallback 문구를 띄운다.
8. **Safe Area** — 고정 헤더는 `pt-safe-top`, 하단 네비는 `pb-safe-bottom`.
   `min-h-screen` 대신 `min-h-dvh` (iOS 동적 주소창 보정).
9. **알림 권한 거부(`denied`) 상태는 코드로 되돌릴 수 없다.** 브라우저 설정에서 직접
   풀어야 하므로 UI 에 안내를 띄운다.
10. **`skipWaiting()` + `clients.claim()`** 없으면 SW 를 고쳐도 기존 사용자에게 반영이 며칠 늦다.

---

## 15. 확장 아이디어

- **인앱 알림 센터** — `activities` 테이블 + `notification_log` 를 합쳐 "읽음/안읽음" 뱃지.
  푸시를 꺼둔 사람도 앱에서 놓친 걸 볼 수 있다.
- **@멘션** — 댓글 본문에서 `@이름` 파싱 → 해당 `user_id` 를 `target_user_ids` 에 추가.
  `mention` 타입을 하나 더 만들면 개별 토글도 된다.
- **회의 리마인더** — 8.6 의 pg_cron + `meeting-reminder` 함수 (시작 1시간 전).
- **할일 마감 임박 알림** — `due_date` 가 내일인 미완료 할일을 매일 아침 담당자에게.
  `notification_log(user_id, 'task_due', task_id)` 유니크로 하루 1회 보장.
- **묶음 발송(daily digest)** — 좋아요처럼 소음이 큰 종류는 즉시 발송 대신
  하루치를 모아 "오늘 회원님 글에 좋아요 7개" 로.
- **AI 오피스 특화** — 회의록 자동 요약이 끝나면 `new_note` 대신 `note_summarized` 타입으로
  "요약이 준비됐어요" 알림. 요약은 Edge Function 에서 돌리고, 완료 시점에 `sendPushToUsers` 직접 호출.

---

## 부록 — 파일 배치 요약

```
public/
  sw.js                                  # Service Worker (5장)
  manifest.webmanifest                   # PWA (6.2)
  icon-192.svg / icon-512.svg
src/
  main.tsx                               # registerServiceWorker()
  index.css                              # 디자인 토큰 (10.1)
  lib/
    push.ts                              # 구독 + prefs 클라이언트 (6.3)
    data/
      notify.ts                          # notify / getActorName / getParentCommentAuthor (6.5)
      activities.ts                      # recordActivity
      posts.ts · tasks.ts · meetings.ts · meeting-notes.ts · agendas.ts
  features/
    social/like-comment-block.tsx        # 좋아요+댓글+답글 UI (10.3)
    notifications/notification-section.tsx      # 개인 설정 (11장)
    notifications/admin-notification-section.tsx # 운영자 글로벌 설정
    tasks/task-row.tsx                   # 할일 행 (10.5)
supabase/
  functions/
    _shared/push.ts                      # Web Push 송신 (5.2)
    notify/index.ts                      # 단일 진입점 (5.1)
  migrations/
    0xx_social.sql                       # likes / comments / parent_id (3장)
    0xx_push_notifications.sql           # 알림 인프라 4테이블 (4장)
    0xx_meetings_agendas.sql             # 회의 · 안건 (8.1)
```

---

*작성 기준: 밋업 앱 프로덕션 코드 (마이그 018 / 019 / 040 / 047 / 048, Edge Function `notify`).*
*밋업 쪽 실동작 상세는 `docs/guides/notifications/current-state.md`, 최초 설계는 `docs/guides/push_notification_guide.md` 참고.*
