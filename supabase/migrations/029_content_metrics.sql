-- ────────────────────────────────────────────────────────
-- 콘텐츠 성과 — 시점별(24h/72h/7d) 스냅샷
-- 조회수보다 저장률(saves/views)·공유율(shares/views)을 중시하는 설계.
-- (저장률·공유율은 저장하지 않고 views/saves/shares로 앱에서 계산 — 중복 저장 회피)
-- 적용일: 2026-08-05. idempotent. (수동 SQL 에디터 적용 — 027·028 이후)
-- ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS content_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  checkpoint      TEXT NOT NULL CHECK (checkpoint IN ('h24','h72','d7')),  -- 24시간|72시간|7일
  views           INTEGER DEFAULT 0,
  likes           INTEGER DEFAULT 0,
  comments        INTEGER DEFAULT 0,
  saves           INTEGER DEFAULT 0,   -- ★ 저장 (핵심 지표)
  shares          INTEGER DEFAULT 0,   -- ★ 공유 (핵심 지표)
  watch_time      NUMERIC,             -- 평균 시청 시간(초)
  completion_rate NUMERIC,             -- 완주율(%)
  follower_delta  INTEGER,             -- 게시 후 팔로워 증감
  measured_at     DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (content_item_id, checkpoint)
);

CREATE INDEX IF NOT EXISTS content_metrics_ws_idx ON content_metrics(workspace_id);
CREATE INDEX IF NOT EXISTS content_metrics_item_idx ON content_metrics(content_item_id);

ALTER TABLE content_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_metrics_select ON content_metrics;
CREATE POLICY content_metrics_select ON content_metrics FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS content_metrics_insert ON content_metrics;
CREATE POLICY content_metrics_insert ON content_metrics FOR INSERT
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS content_metrics_update ON content_metrics;
CREATE POLICY content_metrics_update ON content_metrics FOR UPDATE
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS content_metrics_delete ON content_metrics;
CREATE POLICY content_metrics_delete ON content_metrics FOR DELETE
  USING (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE content_metrics IS '콘텐츠 성과 스냅샷(24h/72h/7d). 저장률·공유율 중심 분석의 원천.';
