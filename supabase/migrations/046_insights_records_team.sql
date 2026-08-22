-- ────────────────────────────────────────────────────────
-- 046: 인사이트·기록 팀 공유 (is_shared + created_by + 팀 SELECT RLS)
-- ────────────────────────────────────────────────────────
-- 배경: insights/journals가 user_id=나로만 조회돼 "개인용"이었다. 오피스는 팀 게시물이어야
-- 댓글·좋아요·활동이 의미가 있다. 기존 할일(041)과 같은 방식으로 팀 공유를 켠다.
-- is_shared(기본 true) + created_by를 추가하고, 공유된 항목은 워크스페이스 멤버가 볼 수 있게
-- SELECT 정책을 추가한다(기존 본인 정책과 OR 결합).
-- idempotent: ADD COLUMN IF NOT EXISTS / DROP POLICY IF EXISTS. 테이블 없으면 가드.

do $$
begin
  if to_regclass('public.insights') is not null then
    alter table insights add column if not exists is_shared boolean not null default true;
    alter table insights add column if not exists created_by uuid;
    -- 기존 행 created_by 백필
    update insights set created_by = user_id where created_by is null;
    drop policy if exists insights_team_select on insights;
    create policy insights_team_select on insights for select
      using (is_shared is true and workspace_id in (select my_workspace_ids()));
  end if;

  if to_regclass('public.journals') is not null then
    alter table journals add column if not exists is_shared boolean not null default true;
    alter table journals add column if not exists created_by uuid;
    update journals set created_by = user_id where created_by is null;
    drop policy if exists journals_team_select on journals;
    create policy journals_team_select on journals for select
      using (is_shared is true and workspace_id in (select my_workspace_ids()));
  end if;
end $$;
