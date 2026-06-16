-- ────────────────────────────────────────────────────────
-- AI 직원 일일 리포트 — Phase 4 (routine 실행 산출물)
-- 적용일: 2026-06-14 · staff 마이그레이션 이후 실행.
-- ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  staff_id     UUID REFERENCES staff(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id),
  date         TEXT NOT NULL,           -- YYYY-MM-DD
  title        TEXT NOT NULL,
  summary      TEXT,
  body         TEXT,
  tokens_in    INT,
  tokens_out   INT,
  model        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS daily_reports_staff_idx ON daily_reports(staff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS daily_reports_ws_idx    ON daily_reports(workspace_id, date DESC);

ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dr_select ON daily_reports;
CREATE POLICY dr_select ON daily_reports FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS dr_insert ON daily_reports;
CREATE POLICY dr_insert ON daily_reports FOR INSERT
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS dr_delete ON daily_reports;
CREATE POLICY dr_delete ON daily_reports FOR DELETE
  USING (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE daily_reports IS 'AI 직원 일과 실행 결과(일일 리포트). 오늘의 브리핑이 이걸 집계';
