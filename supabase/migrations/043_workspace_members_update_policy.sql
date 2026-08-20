-- ────────────────────────────────────────────────────────
-- 043: workspace_members UPDATE 정책 추가
-- ────────────────────────────────────────────────────────
-- 배경: workspace_members 에는 SELECT/INSERT/DELETE 정책만 있고 UPDATE 정책이 없었다.
-- RLS가 켜진 상태에서 UPDATE는 매칭 정책이 없으면 에러 없이 0행 처리되어,
-- 멤버 뷰의 "닉네임 저장 / 역할 변경(오너↔멤버)"이 조용히 저장되지 않았다.
-- 이 마이그레이션은 본인 행(user_id = auth.uid()) 또는 워크스페이스 관리자가
-- 멤버 행을 UPDATE 할 수 있게 정책을 추가한다. (DELETE 정책과 동일한 조건)
-- idempotent: DROP POLICY IF EXISTS 로 재실행 안전.

DROP POLICY IF EXISTS wm_update ON workspace_members;
CREATE POLICY wm_update ON workspace_members FOR UPDATE
  USING (user_id = auth.uid() OR is_workspace_admin(workspace_id))
  WITH CHECK (user_id = auth.uid() OR is_workspace_admin(workspace_id));
