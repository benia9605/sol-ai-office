-- ────────────────────────────────────────────────────────
-- content_items 확장 — 대표 제품 연결 + 목적/담당/예정일
-- primary_product_id: 단일 대표 제품(복수 연결 content_products는 후속 Phase)
-- 적용일: 2026-08-05. idempotent. (수동 SQL 에디터 적용 — 027 이후)
-- ────────────────────────────────────────────────────────

ALTER TABLE content_items ADD COLUMN IF NOT EXISTS primary_product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS content_purpose TEXT;   -- view|follow|save|sale|brand
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS owner TEXT;             -- 쏠닝|홍대표|AI|외주 …
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;  -- 발행 예정일

CREATE INDEX IF NOT EXISTS content_items_product_idx ON content_items(primary_product_id);

COMMENT ON COLUMN content_items.primary_product_id IS '대표 제품(단일). 복수 연결은 후속 content_products.';
COMMENT ON COLUMN content_items.content_purpose IS '콘텐츠 목적: view|follow|save|sale|brand.';
COMMENT ON COLUMN content_items.owner IS '담당자(자유텍스트): 쏠닝|홍대표|AI|외주 등.';
COMMENT ON COLUMN content_items.scheduled_for IS '발행 예정일시.';
