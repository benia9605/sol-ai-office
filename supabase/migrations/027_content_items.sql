-- ────────────────────────────────────────────────────────
-- 027: 콘텐츠 아이템(content_items) — 아이디어→발행 수명주기 (MVP)
-- ────────────────────────────────────────────────────────
-- 릴스·쇼츠 등 제작 파이프라인의 중심 엔티티.
-- 적용일: 2026-08-04. idempotent. (수동 SQL 에디터 적용)
-- ※ MVP 범위 고정: campaign/goal/report/task 연결·jsonb 구조화는 후속.
-- ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS content_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  platform     TEXT,                         -- reels|shorts|youtube|instagram|tiktok|blog
  content_type TEXT CHECK (content_type IN ('desire','info','worldview','behind')),  -- 욕망|정보|세계관|비하인드
  status       TEXT NOT NULL DEFAULT 'idea'
               CHECK (status IN ('idea','approved','scripted','shooting','editing','scheduled','published','archived')),
  hook         TEXT,
  script       TEXT,
  shot_list    TEXT,
  url          TEXT,
  published_at TIMESTAMPTZ,                   -- 발행 시 자동 기록
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_items_ws_idx ON content_items(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS content_items_ws_status_idx ON content_items(workspace_id, status);

ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_items_select ON content_items;
CREATE POLICY content_items_select ON content_items FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS content_items_insert ON content_items;
CREATE POLICY content_items_insert ON content_items FOR INSERT
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS content_items_update ON content_items;
CREATE POLICY content_items_update ON content_items FOR UPDATE
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS content_items_delete ON content_items;
CREATE POLICY content_items_delete ON content_items FOR DELETE
  USING (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE content_items IS '콘텐츠 아이템 — 아이디어→발행 수명주기(MVP). 릴스/쇼츠 제작 파이프라인 중심 엔티티.';
