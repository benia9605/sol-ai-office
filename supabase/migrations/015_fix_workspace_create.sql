-- ────────────────────────────────────────────────────────
-- 015: 워크스페이스 "생성에 실패" 버그 수정
-- 원인: createWorkspace가 insert 직후 RETURNING(.select())으로 행을 돌려받는데,
--       그 시점엔 본인이 아직 workspace_members에 없어 RLS workspaces_select
--       (멤버십 기반)에 막혀 0 rows → .single() 에러 → "생성에 실패".
-- 해결: SELECT 정책에 created_by = auth.uid() 추가 (생성자는 멤버 등록 전에도 자기 것 조회).
-- 겸사: delete 정책의 type='team'(실제 값은 'office')도 바로잡아 office 삭제 허용.
-- 적용일: 2026-06-17. idempotent.
-- ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS workspaces_select ON workspaces;
CREATE POLICY workspaces_select ON workspaces FOR SELECT
  USING (id IN (SELECT my_workspace_ids()) OR created_by = auth.uid());

DROP POLICY IF EXISTS workspaces_delete ON workspaces;
CREATE POLICY workspaces_delete ON workspaces FOR DELETE
  USING (is_workspace_admin(id));
