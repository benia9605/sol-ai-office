-- ============================================================
-- 047 — 할일(과제) 좋아요 + 댓글
--
-- 할일을 과제처럼 쓰는 흐름에서 "확인했어요 / 응원" 좋아요 + 진행 논의
-- 댓글. 할일은 노트와 달리 공개/비공개 구분이 없으므로 워크스페이스
-- 멤버면 모두 조회·작성 가능. insight_likes / reading_note_comments 와
-- 동일 패턴.
-- ============================================================

-- ─── task_likes ────────────────────────────────────────────────
create table if not exists public.task_likes (
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.user_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index if not exists task_likes_user_idx
  on public.task_likes(user_id);

alter table public.task_likes enable row level security;

drop policy if exists task_likes_select on public.task_likes;
create policy task_likes_select on public.task_likes
  for select to authenticated using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_workspace_member(t.workspace_id)
    )
  );

drop policy if exists task_likes_insert on public.task_likes;
create policy task_likes_insert on public.task_likes
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_workspace_member(t.workspace_id)
    )
  );

drop policy if exists task_likes_delete on public.task_likes;
create policy task_likes_delete on public.task_likes
  for delete to authenticated using (user_id = auth.uid());

-- ─── task_comments ─────────────────────────────────────────────
create table if not exists public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.user_profiles(user_id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists task_comments_task_idx
  on public.task_comments(task_id, created_at);

alter table public.task_comments enable row level security;

drop policy if exists task_comments_select on public.task_comments;
create policy task_comments_select on public.task_comments
  for select to authenticated using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_workspace_member(t.workspace_id)
    )
  );

drop policy if exists task_comments_insert on public.task_comments;
create policy task_comments_insert on public.task_comments
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_workspace_member(t.workspace_id)
    )
  );

drop policy if exists task_comments_delete on public.task_comments;
create policy task_comments_delete on public.task_comments
  for delete to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_workspace_admin(t.workspace_id)
    )
  );

notify pgrst, 'reload schema';
