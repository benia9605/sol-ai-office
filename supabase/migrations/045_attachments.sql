-- ────────────────────────────────────────────────────────
-- 045: 첨부파일 (polymorphic attachments + 비공개 버킷)
-- ────────────────────────────────────────────────────────
-- 배경: 이식 킷 04 — 할일/회의/인사이트/기록 등에 자료·이미지·문서를 붙일 수 있어야 한다.
-- 기존 uploads 버킷은 public·이미지 5MB 전용이라 회사 자료용으로 부적합.
-- 이 마이그레이션은
--   ① 비공개 Storage 버킷 'attachments' (30MB 제한) 생성
--   ② 리소스 종류에 상관없이 재사용하는 polymorphic attachments 테이블 생성
--   ③ 워크스페이스 멤버만 읽고/올리고/지울 수 있게 RLS (테이블 + storage.objects)
-- 파일 경로 규칙: {workspace_id}/{ref_type}/{ref_id}/{uuid}-{파일명}
--   → storage RLS가 경로 첫 세그먼트(workspace_id)로 접근을 통제한다.
-- idempotent: IF NOT EXISTS / on conflict / DROP POLICY IF EXISTS.

-- ── ① 비공개 버킷 (30MB = 31457280 bytes) ──
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 31457280)
on conflict (id) do update set public = false, file_size_limit = 31457280;

-- ── ② attachments 테이블 (polymorphic) ──
create table if not exists attachments (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  ref_type     text not null,          -- 'task' | 'meeting' | 'insight' | 'record' | ...
  ref_id       text not null,          -- 대상 리소스 id (FK 없음 — polymorphic)
  storage_path text not null,          -- attachments 버킷 내 경로
  filename     text not null,
  mime         text,
  size_bytes   bigint,
  uploaded_by  uuid,
  created_at   timestamptz not null default now()
);
create index if not exists attachments_ref_idx on attachments(ref_type, ref_id);
create index if not exists attachments_ws_idx on attachments(workspace_id);

alter table attachments enable row level security;

drop policy if exists attachments_select on attachments;
create policy attachments_select on attachments for select
  using (workspace_id in (select my_workspace_ids()));
drop policy if exists attachments_insert on attachments;
create policy attachments_insert on attachments for insert
  with check (workspace_id in (select my_workspace_ids()) and uploaded_by = auth.uid());
drop policy if exists attachments_delete on attachments;
create policy attachments_delete on attachments for delete
  using (workspace_id in (select my_workspace_ids()));

-- ── ③ storage.objects RLS (버킷 'attachments', 경로 첫 세그먼트 = workspace_id) ──
drop policy if exists attachments_obj_select on storage.objects;
create policy attachments_obj_select on storage.objects for select
  using (bucket_id = 'attachments'
         and ((storage.foldername(name))[1])::uuid in (select my_workspace_ids()));
drop policy if exists attachments_obj_insert on storage.objects;
create policy attachments_obj_insert on storage.objects for insert
  with check (bucket_id = 'attachments'
              and ((storage.foldername(name))[1])::uuid in (select my_workspace_ids()));
drop policy if exists attachments_obj_delete on storage.objects;
create policy attachments_obj_delete on storage.objects for delete
  using (bucket_id = 'attachments'
         and ((storage.foldername(name))[1])::uuid in (select my_workspace_ids()));
