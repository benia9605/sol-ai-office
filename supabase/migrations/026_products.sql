-- ────────────────────────────────────────────────────────
-- 제품 카탈로그 — 브랜드(워크스페이스)별 제품 원장
-- 콘텐츠/매출/소싱의 기반 데이터. brand_contexts.main_products 자유텍스트를 대체.
-- 적용일: 2026-08-04. idempotent. (수동 SQL 에디터 적용)
-- ────────────────────────────────────────────────────────

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
