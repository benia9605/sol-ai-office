-- ────────────────────────────────────────────────────────
-- 026: 제품 카탈로그(products) — 워크스페이스별 제품 원장
-- ────────────────────────────────────────────────────────
-- 배경: 제품 정보가 brand_contexts.main_products 자유텍스트뿐이라 제품별 마진·재고·성과를
--   구조화해 관리할 수 없었다. 콘텐츠/매출/소싱 분석의 기반 데이터로 정식 테이블화.
-- 워크스페이스 스코프 + RLS(my_workspace_ids). status: active|draft|discontinued.
-- ※ 이후 방향 전환(시목앱=System of Record)으로 조회·분석 레이어로 사용(마이그 032 참조).
-- 적용일: 2026-08-04. idempotent. (수동 SQL 에디터 적용)

CREATE TABLE IF NOT EXISTS products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  sku          TEXT,                     -- 상품코드(선택)
  category     TEXT,                     -- 도마 · 가구 · 소품 등
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','draft','discontinued')),
  price        NUMERIC,                  -- 판매가
  cost         NUMERIC,                  -- 원가(마진 계산용)
  stock        INTEGER DEFAULT 0,        -- 재고
  image_url    TEXT,
  description  TEXT,
  tags         TEXT[],
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_ws_idx ON products(workspace_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS products_ws_sku_idx ON products(workspace_id, sku) WHERE sku IS NOT NULL;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_select ON products;
CREATE POLICY products_select ON products FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS products_insert ON products;
CREATE POLICY products_insert ON products FOR INSERT
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS products_update ON products;
CREATE POLICY products_update ON products FOR UPDATE
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS products_delete ON products;
CREATE POLICY products_delete ON products FOR DELETE
  USING (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE products IS '제품 카탈로그 — 워크스페이스별 제품 원장(판매가/원가/재고/상태). 콘텐츠·매출·소싱의 기반 데이터.';
