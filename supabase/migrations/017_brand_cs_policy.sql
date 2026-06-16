-- ────────────────────────────────────────────────────────
-- 017: 회사 브레인에 CS 정책 + CS 톤 추가
-- CS 직원이 배송/교환/환불 정책 범위 내에서, 브랜드별 응대 톤으로 답하도록.
-- 적용일: 2026-06-17. idempotent.
-- ────────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('public.brand_contexts') IS NOT NULL THEN
    ALTER TABLE brand_contexts ADD COLUMN IF NOT EXISTS cs_policies TEXT;  -- 배송/교환/환불/파손 기준
    ALTER TABLE brand_contexts ADD COLUMN IF NOT EXISTS cs_tone TEXT;      -- 공감강도·이모지·문장길이·환불태도
  END IF;
END $$;

COMMENT ON COLUMN brand_contexts.cs_policies IS 'CS 정책 — 배송/교환/환불/파손 기준. CS 직원이 정책 범위 내 응대.';
COMMENT ON COLUMN brand_contexts.cs_tone IS 'CS 응대 톤 — 공감 강도·이모지·문장 길이·환불 태도.';
