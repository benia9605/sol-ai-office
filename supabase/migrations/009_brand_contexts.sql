-- ────────────────────────────────────────────────────────
-- 회사 브레인 (brand_contexts) — AI 직원 프롬프트 ①계층
-- 설계: docs/guides/ai오피스구축/_회사오피스_최종플랜.md §1-4, _직원별_실행스펙_시목.md §0
-- 적용일: 2026-06-15
-- ⚠️ 대시보드 SQL 에디터에서 검토 후 적용. workspaces(004) 이후 실행.
-- 워크스페이스 1:1 (회사 하나 = 브레인 하나). 모든 직원의 시스템 프롬프트 최상단에 캐싱 주입.
-- ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brand_contexts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  identity       TEXT,   -- 정체성 한 줄 ("시목 — 오래 쓰는 원목 가구·소품…")
  category       TEXT,   -- 카테고리 ("원목 인테리어 가구/소품")
  tone           TEXT,   -- 톤앤매너 ("장인·자연·따뜻·담백")
  target         TEXT,   -- 주요 타겟
  usp            TEXT,   -- 핵심 USP (줄바꿈 구분)
  channels       TEXT,   -- 판매 채널
  price_position TEXT,   -- 가격 포지셔닝
  ad_angle       TEXT,   -- 광고 소구점
  compliance     TEXT,   -- 금지표현/컴플라이언스 (줄바꿈 구분)
  main_products  TEXT,   -- 주력 상품
  price_range    TEXT,   -- 대표 가격대
  competitors    TEXT,   -- 주요 경쟁사
  story          TEXT,   -- 창업 스토리/차별점
  raw            TEXT,   -- 자유 서술 (모델에 그대로 주입)
  version        INT NOT NULL DEFAULT 1,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brand_contexts_ws_idx ON brand_contexts(workspace_id);

ALTER TABLE brand_contexts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bc_select ON brand_contexts;
CREATE POLICY bc_select ON brand_contexts FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS bc_insert ON brand_contexts;
CREATE POLICY bc_insert ON brand_contexts FOR INSERT
  WITH CHECK (user_id = auth.uid() AND workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS bc_update ON brand_contexts;
CREATE POLICY bc_update ON brand_contexts FOR UPDATE
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS bc_delete ON brand_contexts;
CREATE POLICY bc_delete ON brand_contexts FOR DELETE
  USING (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE brand_contexts IS '회사 브레인 (워크스페이스 1:1). AI 직원 시스템 프롬프트 ①계층에 주입.';
