-- ────────────────────────────────────────────────────────
-- 035: 모니터링 = 트렌드 레이더 — 워치리스트(watch_items) + 스냅샷(watch_snapshots)
-- ────────────────────────────────────────────────────────
-- 배경(GPT 설계 v2): 모니터링 직원 = Trend Radar(별도 기능 분리 X, 통합).
--   두 종류를 감시: (1) Competitor Watch(직접/인접/지향 경쟁사) (2) Audience Trend(고객이 보는 키워드).
--   변화가 크면 대응(가격/구성/메시지) 제안 + 트렌드 레퍼런스를 시목 콘텐츠 아이디어로 넘긴다.
-- 이 마이그레이션이 하는 것:
--   1) watch_items — 경쟁사/키워드 1건. kind·watch_type·topics·memo·last_checked_at.
--   2) watch_snapshots — 워치 항목의 시점별 관찰(가격·제목·요약·source_url). 이전과 비교해 변화 감지.
-- 원칙: MVP는 수기/검색결과 저장 + 변화 비교. 자동 크롤링·실시간 가격감시는 2차.
-- 적용일: 2026-08-17. idempotent. (수동 SQL 에디터 적용)
-- ────────────────────────────────────────────────────────

-- 1) 워치리스트 (경쟁사 · 키워드)
CREATE TABLE IF NOT EXISTS watch_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind           TEXT NOT NULL DEFAULT 'competitor',  -- competitor|keyword
  name           TEXT NOT NULL,
  url            TEXT,
  watch_type     TEXT,                                -- direct|adjacent|aspirational (경쟁사) | product|desire|mood|format (키워드)
  topics         TEXT[],                              -- 체크할 항목(신제품·가격·리뷰 …)
  memo           TEXT,
  status         TEXT NOT NULL DEFAULT 'active',      -- active|archived
  last_checked_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS watch_items_ws_idx ON watch_items(workspace_id, kind);

-- 2) 스냅샷 (시점별 관찰 → 변화 비교)
CREATE TABLE IF NOT EXISTS watch_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_item_id UUID NOT NULL REFERENCES watch_items(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  price         NUMERIC,
  title         TEXT,
  summary       TEXT,
  source_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS watch_snapshots_item_idx ON watch_snapshots(watch_item_id, checked_at DESC);

-- RLS (오피스 공용 — my_workspace_ids)
ALTER TABLE watch_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS watch_items_select ON watch_items;
CREATE POLICY watch_items_select ON watch_items FOR SELECT USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS watch_items_insert ON watch_items;
CREATE POLICY watch_items_insert ON watch_items FOR INSERT WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS watch_items_update ON watch_items;
CREATE POLICY watch_items_update ON watch_items FOR UPDATE USING (workspace_id IN (SELECT my_workspace_ids())) WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS watch_items_delete ON watch_items;
CREATE POLICY watch_items_delete ON watch_items FOR DELETE USING (workspace_id IN (SELECT my_workspace_ids()));

DROP POLICY IF EXISTS watch_snapshots_select ON watch_snapshots;
CREATE POLICY watch_snapshots_select ON watch_snapshots FOR SELECT USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS watch_snapshots_insert ON watch_snapshots;
CREATE POLICY watch_snapshots_insert ON watch_snapshots FOR INSERT WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS watch_snapshots_delete ON watch_snapshots;
CREATE POLICY watch_snapshots_delete ON watch_snapshots FOR DELETE USING (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE watch_items IS '트렌드 레이더 워치리스트 — 경쟁사(direct/adjacent/aspirational)·고객 키워드(product/desire/mood/format).';
COMMENT ON TABLE watch_snapshots IS '워치 항목 시점별 관찰 → 이전과 비교해 변화 감지.';
