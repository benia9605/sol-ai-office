-- ============================================================
-- 011 — Supabase Storage
--
-- 두 개 버킷 셋업:
--  * avatars      — public, 자신의 프로필 사진. user 폴더 단위로 격리.
--  * attachments  — private, 회의록 / 할일 / 인사이트에 붙는 파일.
--                  워크스페이스 멤버만 접근.
--
-- attachments 테이블은 storage object 의 메타데이터를 도메인 ref 와 묶어
-- 보관 (ref_type + ref_id 폴리모픽).
-- ============================================================

-- ----------------------------------------------------------------
-- 버킷 생성
-- ----------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('attachments', 'attachments', false)
  on conflict (id) do nothing;

-- ----------------------------------------------------------------
-- attachments 테이블 (메타데이터)
-- ref_type 예시: 'meeting_note' | 'task' | 'insight' | 'meeting'
-- ----------------------------------------------------------------
create table public.attachments (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ref_type     text not null,
  ref_id       uuid not null,
  storage_path text not null,
  filename     text not null,
  mime         text,
  size_bytes   bigint,
  uploaded_by  uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create index attachments_ref_idx
  on public.attachments(ref_type, ref_id);
create index attachments_workspace_idx
  on public.attachments(workspace_id);

alter table public.attachments enable row level security;

create policy attachments_select_member on public.attachments
  for select to authenticated using (public.is_workspace_member(workspace_id));

create policy attachments_insert_member on public.attachments
  for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and uploaded_by = auth.uid()
  );

create policy attachments_delete_owner_or_admin on public.attachments
  for delete to authenticated
  using (
    uploaded_by = auth.uid()
    or public.is_workspace_admin(workspace_id)
  );

-- ----------------------------------------------------------------
-- Storage RLS — avatars 버킷
-- 경로 컨벤션: avatars/{user_id}/{filename}
-- ----------------------------------------------------------------
create policy "avatars_read_public" on storage.objects
  for select to authenticated, anon
  using (bucket_id = 'avatars');

create policy "avatars_insert_self" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_self" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_self" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------
-- Storage RLS — attachments 버킷
-- 경로 컨벤션: attachments/{workspace_id}/{ref_type}/{ref_id}/{uuid-filename}
-- 워크스페이스 멤버만 read; 자기 자신만 upload; 본인 + admin 삭제.
-- ----------------------------------------------------------------
create policy "attachments_read_member" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and public.is_workspace_member(
      ((storage.foldername(name))[1])::uuid
    )
  );

create policy "attachments_insert_member" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and public.is_workspace_member(
      ((storage.foldername(name))[1])::uuid
    )
    and owner = auth.uid()
  );

create policy "attachments_delete_owner_or_admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (
      owner = auth.uid()
      or public.is_workspace_admin(
        ((storage.foldername(name))[1])::uuid
      )
    )
  );
