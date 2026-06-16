-- ────────────────────────────────────────────────────────
-- reading_logs(스터디/독서 노트)에 워크스페이스 공유 컬럼 추가
-- - 004에서 테이블명을 study_notes로 잘못 적어 reading_logs가 누락됐던 것 보정.
-- - reading_logs 는 이미 존재하는 테이블(스터디노트 기능에서 사용 중).
-- 적용일: 2026-06-15 · 004 이후 실행.
-- ────────────────────────────────────────────────────────
ALTER TABLE reading_logs ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
ALTER TABLE reading_logs ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS reading_logs_ws_idx ON reading_logs(workspace_id);

-- 기존 행 → 작성자 개인 워크스페이스로 백필
UPDATE reading_logs AS c SET workspace_id = (
  SELECT w.id FROM workspaces w WHERE w.created_by = c.user_id AND w.type = 'personal' LIMIT 1
) WHERE c.workspace_id IS NULL;

-- 가산적 공유 정책 (기존 user_id 정책 유지)
DROP POLICY IF EXISTS reading_logs_select_ws ON reading_logs;
CREATE POLICY reading_logs_select_ws ON reading_logs FOR SELECT
  USING (is_shared AND workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS reading_logs_update_ws ON reading_logs;
CREATE POLICY reading_logs_update_ws ON reading_logs FOR UPDATE
  USING (is_shared AND workspace_id IN (SELECT my_workspace_ids()));
