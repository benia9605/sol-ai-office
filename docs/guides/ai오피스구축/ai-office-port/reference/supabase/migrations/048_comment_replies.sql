-- ============================================================
-- 048 — 댓글 답글 (parent_id)
--
-- 댓글이 있는 모든 테이블에 self-referencing parent_id 추가.
-- null = 최상위 댓글, 값 있음 = 그 댓글에 대한 답글 (1단계).
-- 부모 댓글 삭제 시 답글도 함께 제거 (on delete cascade).
--
-- `alter table if exists` + `add column if not exists` 로 방어적 작성:
--   - prod 에 아직 없는 테이블(예: reading_note_comments — 023 미적용)은
--     에러 없이 건너뜀.
--   - 여러 번 재실행해도 안전 (idempotent).
--   - 누락 테이블을 나중에 만든 뒤 이 스크립트를 다시 돌리면 그때 parent_id 추가.
-- RLS 는 기존 insert/select/delete 정책 그대로 (parent_id 는 일반 컬럼).
-- ============================================================

alter table if exists public.insight_comments
  add column if not exists parent_id uuid
  references public.insight_comments(id) on delete cascade;

alter table if exists public.writing_comments
  add column if not exists parent_id uuid
  references public.writing_comments(id) on delete cascade;

alter table if exists public.reading_comments
  add column if not exists parent_id uuid
  references public.reading_comments(id) on delete cascade;

alter table if exists public.reading_note_comments
  add column if not exists parent_id uuid
  references public.reading_note_comments(id) on delete cascade;

alter table if exists public.agenda_comments
  add column if not exists parent_id uuid
  references public.agenda_comments(id) on delete cascade;

alter table if exists public.task_comments
  add column if not exists parent_id uuid
  references public.task_comments(id) on delete cascade;

notify pgrst, 'reload schema';
