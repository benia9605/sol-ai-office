-- ────────────────────────────────────────────────────────
-- staff_output_actions — AI 액션 승인 큐 (정밀 로직: HITL 승인 게이트)
-- 설계: docs/guides/ai오피스구축/_회사오피스_최종플랜.md §1-4 (suggested→approved→done/dismissed)
-- 적용일: 2026-06-16 · daily_reports(010) 이후 실행. idempotent.
-- AI 직원이 제안한 액션(일정/할일/인사이트)을 바로 등록하지 않고 여기 'suggested'로 쌓는다.
-- 사장이 승인하면 status='approved' + 실제 schedules/tasks/insights로 승격(앱 로직).
-- ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_output_actions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  staff_id     UUID REFERENCES staff(id) ON DELETE SET NULL,
  report_id    UUID REFERENCES daily_reports(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,                                  -- 'schedule' | 'task' | 'insight'
  status       TEXT NOT NULL DEFAULT 'suggested'               -- 'suggested' | 'approved' | 'dismissed'
               CHECK (status IN ('suggested','approved','dismissed')),
  payload      JSONB NOT NULL,                                 -- 액션 내용(제목·날짜·우선순위 등)
  promoted_id  UUID,                                           -- 승인 시 생성된 schedules/tasks/insights row id
  approved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS soa_ws_status_idx ON staff_output_actions(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS soa_report_idx    ON staff_output_actions(report_id);

ALTER TABLE staff_output_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS soa_select ON staff_output_actions;
CREATE POLICY soa_select ON staff_output_actions FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS soa_insert ON staff_output_actions;
CREATE POLICY soa_insert ON staff_output_actions FOR INSERT
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS soa_update ON staff_output_actions;
CREATE POLICY soa_update ON staff_output_actions FOR UPDATE
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS soa_delete ON staff_output_actions;
CREATE POLICY soa_delete ON staff_output_actions FOR DELETE
  USING (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE staff_output_actions IS 'AI 직원이 제안한 액션 큐. suggested→(사장 승인)→approved+실제 테이블 승격. HITL.';
