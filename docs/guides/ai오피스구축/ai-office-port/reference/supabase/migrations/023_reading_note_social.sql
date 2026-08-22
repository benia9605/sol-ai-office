-- ============================================================
-- 023 — 독서 노트 좋아요 + 댓글
--
-- 자료(readings) 단위가 아닌 노트(reading_notes) 단위로 인터랙션.
-- insight_likes / insight_comments 와 동일 패턴.
-- ============================================================

-- ─── reading_note_likes ────────────────────────────────────────
create table if not exists public.reading_note_likes (
  note_id    uuid not null references public.reading_notes(id) on delete cascade,
  user_id    uuid not null references public.user_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, user_id)
);
create index if not exists reading_note_likes_user_idx
  on public.reading_note_likes(user_id);

alter table public.reading_note_likes enable row level security;

drop policy if exists reading_note_likes_select on public.reading_note_likes;
create policy reading_note_likes_select on public.reading_note_likes
  for select to authenticated using (
    exists (
      select 1 from public.reading_notes n
      where n.id = note_id
        and public.is_workspace_member(n.workspace_id)
        and (n.is_shared or n.user_id = auth.uid())
    )
  );

drop policy if exists reading_note_likes_insert on public.reading_note_likes;
create policy reading_note_likes_insert on public.reading_note_likes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists reading_note_likes_delete on public.reading_note_likes;
create policy reading_note_likes_delete on public.reading_note_likes
  for delete to authenticated using (user_id = auth.uid());

-- ─── reading_note_comments ─────────────────────────────────────
create table if not exists public.reading_note_comments (
  id         uuid primary key default gen_random_uuid(),
  note_id    uuid not null references public.reading_notes(id) on delete cascade,
  user_id    uuid not null references public.user_profiles(user_id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists reading_note_comments_note_idx
  on public.reading_note_comments(note_id, created_at);

alter table public.reading_note_comments enable row level security;

drop policy if exists reading_note_comments_select on public.reading_note_comments;
create policy reading_note_comments_select on public.reading_note_comments
  for select to authenticated using (
    exists (
      select 1 from public.reading_notes n
      where n.id = note_id
        and public.is_workspace_member(n.workspace_id)
        and (n.is_shared or n.user_id = auth.uid())
    )
  );

drop policy if exists reading_note_comments_insert on public.reading_note_comments;
create policy reading_note_comments_insert on public.reading_note_comments
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.reading_notes n
      where n.id = note_id
        and public.is_workspace_member(n.workspace_id)
        and (n.is_shared or n.user_id = auth.uid())
    )
  );

drop policy if exists reading_note_comments_delete on public.reading_note_comments;
create policy reading_note_comments_delete on public.reading_note_comments
  for delete to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.reading_notes n
      where n.id = note_id
        and public.is_workspace_admin(n.workspace_id)
    )
  );

notify pgrst, 'reload schema';
