-- ────────────────────────────────────────────────────────
-- AI 직원 시스템 (회사 오피스) — Phase 3
-- 확정설계: docs/guides/ai오피스구축/_개편_통합설계_Phase.md §4
-- 적용일: 2026-06-14
-- ⚠️ 대시보드 SQL 에디터에서 검토 후 적용. workspaces 마이그레이션 이후 실행.
-- ────────────────────────────────────────────────────────

-- 고용된 직원
CREATE TABLE IF NOT EXISTS staff (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- 채용한 사람
  type_key     TEXT NOT NULL,             -- 카탈로그 타입 키
  name         TEXT NOT NULL,
  prompt       TEXT,                      -- Sol이 직접 입력한 성격/지시
  model        TEXT NOT NULL DEFAULT 'sonnet' CHECK (model IN ('sonnet','haiku')),
  state        TEXT NOT NULL DEFAULT 'idle' CHECK (state IN ('working','idle')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 직원 일과 (매일/주간/실시간)
CREATE TABLE IF NOT EXISTS staff_routines (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  schedule     TEXT NOT NULL DEFAULT 'daily' CHECK (schedule IN ('realtime','daily','weekly')),
  run_at       TEXT,                      -- 'HH:MM' (daily/weekly)
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_ws_idx          ON staff(workspace_id);
CREATE INDEX IF NOT EXISTS staff_routines_staff_idx ON staff_routines(staff_id);

-- RLS (워크스페이스 멤버면 조회/관리)
ALTER TABLE staff          ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_routines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_select ON staff;
CREATE POLICY staff_select ON staff FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS staff_insert ON staff;
CREATE POLICY staff_insert ON staff FOR INSERT
  WITH CHECK (user_id = auth.uid() AND workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS staff_update ON staff;
CREATE POLICY staff_update ON staff FOR UPDATE
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS staff_delete ON staff;
CREATE POLICY staff_delete ON staff FOR DELETE
  USING (workspace_id IN (SELECT my_workspace_ids()));

DROP POLICY IF EXISTS sr_select ON staff_routines;
CREATE POLICY sr_select ON staff_routines FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS sr_write ON staff_routines;
CREATE POLICY sr_write ON staff_routines FOR ALL
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE staff IS 'AI 직원 (타입 인스턴스). routine을 cron이 돌려 daily_reports 적재(Phase 4)';
