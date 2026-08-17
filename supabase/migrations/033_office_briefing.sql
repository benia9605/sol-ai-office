-- ────────────────────────────────────────────────────────
-- 033: 오피스 CEO 브리핑(office_briefings) + 워크스페이스 월 매출 목표
-- ────────────────────────────────────────────────────────
-- 배경(GPT 설계 v2): AI Office = "AI가 데이터를 읽고 자동으로 일하는 운영 시스템".
--   운영매니저가 전 직원 신호를 취합해 CEO 브리핑 JSON을 생성하고,
--   대시보드는 AI를 따로 호출하지 않고 이 JSON만 렌더한다(Source of Truth).
-- 이 마이그레이션이 하는 것:
--   1) workspaces.monthly_sales_target — 월 매출 목표(수동 설정). 브리핑 달성률 계산용. 하드코딩 X.
--   2) office_briefings — 워크스페이스×날짜 1행. brief_json(jsonb)에 CEO 브리핑 계약 저장.
--      (기존 daily_briefings는 개인(user_id) 스키마라 분리 — 오피스는 workspace 단위 새 테이블)
-- 원칙: 원본 데이터는 기존 테이블(sales_daily·content_metrics·tasks·schedules·staff_output_actions).
--       brief_json은 "그 데이터를 어떻게 해석했는가"의 스냅샷일 뿐(원본 아님).
-- 적용일: 2026-08-17. idempotent. (수동 SQL 에디터 적용)
-- ────────────────────────────────────────────────────────

-- 1) 월 매출 목표 (수동 설정 · nullable)
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS monthly_sales_target NUMERIC;
COMMENT ON COLUMN workspaces.monthly_sales_target IS '월 매출 목표(원). 수동 설정. 브리핑 달성률 계산용. NULL이면 달성률 미표시.';

-- 2) 오피스 CEO 브리핑
CREATE TABLE IF NOT EXISTS office_briefings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  briefing_date DATE NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'daily',   -- daily|weekly
  brief_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, briefing_date, kind)
);

CREATE INDEX IF NOT EXISTS office_briefings_ws_date_idx ON office_briefings(workspace_id, briefing_date DESC);

ALTER TABLE office_briefings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS office_briefings_select ON office_briefings;
CREATE POLICY office_briefings_select ON office_briefings FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS office_briefings_insert ON office_briefings;
CREATE POLICY office_briefings_insert ON office_briefings FOR INSERT
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS office_briefings_update ON office_briefings;
CREATE POLICY office_briefings_update ON office_briefings FOR UPDATE
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS office_briefings_delete ON office_briefings;
CREATE POLICY office_briefings_delete ON office_briefings FOR DELETE
  USING (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE office_briefings IS '오피스 CEO 브리핑(워크스페이스×날짜×kind). brief_json=운영매니저 산출물. 대시보드가 이것만 렌더.';
