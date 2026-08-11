-- ────────────────────────────────────────────────────────
-- 일 매출 — 채널×날짜 단위 집계 (중심 테이블)
-- Orders/Products/Content/Dashboard가 모두 연결되는 허브.
-- 확장성 설계:
--   · source(채널 차원) + UNIQUE(workspace_id, source, date) → 채널별 일 1행
--   · extra(jsonb) → 플랫폼별 확장 지표 무중단 수용
--   · aov(객단가)·전환율은 저장 안 하고 revenue/orders/visitors로 앱에서 계산
--   · 제품/콘텐츠 라인레벨 귀속은 후속 sales_items(product_id·content_item_id)로 확장
-- external_kpis(020) 통합/ETL은 후속(기존 push 계약 보존 위해 지금은 병존).
-- 적용일: 2026-08-05. idempotent. (수동 SQL 에디터 적용)
-- ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sales_daily (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  date         DATE NOT NULL,
  source       TEXT NOT NULL DEFAULT 'total',  -- smartstore|coupang|ohouse|self|instagram|total|other
  revenue      NUMERIC,
  orders       INTEGER,
  visitors     INTEGER,
  memo         TEXT,
  extra        JSONB,                          -- 플랫폼별 확장 지표
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, source, date)
);

CREATE INDEX IF NOT EXISTS sales_daily_ws_date_idx ON sales_daily(workspace_id, date DESC);

ALTER TABLE sales_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_daily_select ON sales_daily;
CREATE POLICY sales_daily_select ON sales_daily FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS sales_daily_insert ON sales_daily;
CREATE POLICY sales_daily_insert ON sales_daily FOR INSERT
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS sales_daily_update ON sales_daily;
CREATE POLICY sales_daily_update ON sales_daily FOR UPDATE
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS sales_daily_delete ON sales_daily;
CREATE POLICY sales_daily_delete ON sales_daily FOR DELETE
  USING (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE sales_daily IS '일 매출(채널×날짜). Orders/Products/Content/Dashboard 연결 허브. aov·전환율은 계산값.';
