-- ============================================================
-- 007 — 활동 피드 (activities)
--
-- 워크스페이스 안에서 일어난 일들을 append-only 로 기록.
-- 도메인 변경 함수 (createTask, completeTask, shareInsight, …) 가
-- 작업 직후 recordActivity() 를 호출해 한 줄을 남긴다.
--
-- action 키 (현 시점):
--   'created_task'        / 'completed_task'
--   'created_meeting'     / 'created_meeting_note'
--   'shared_insight'      / 'liked_insight'   / 'commented_insight'
--   'joined_workspace'
-- metadata 예: { "title": "…", "extra": "…" }
-- ============================================================

create table public.activities (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  action        text not null,
  resource_type text,                        -- 'task' | 'insight' | 'meeting' | 'note' | 'workspace'
  resource_id   uuid,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index activities_workspace_idx on public.activities(workspace_id, created_at desc);
create index activities_user_idx      on public.activities(user_id, created_at desc);

-- ============================================================
-- RLS — 멤버 누구나 읽기 / 본인만 본인 행 insert / 수정·삭제 금지
-- ============================================================
alter table public.activities enable row level security;

create policy activities_select on public.activities
  for select to authenticated using (public.is_workspace_member(workspace_id));

create policy activities_insert on public.activities
  for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and user_id = auth.uid()
  );
