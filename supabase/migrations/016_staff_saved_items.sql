-- ────────────────────────────────────────────────────────
-- 직원별 보관함 — 리포트 산출물 중 좋은 항목을 ⭐로 골라 저장
-- 광고=카피 라이브러리, SNS=콘텐츠 캘린더, 소싱=상품 후보 보관함 등
-- 직원 타입(output_kind)별로 같은 테이블에 저장, 앱에서 타입별 UI로 표시.
-- 적용일: 2026-06-17. idempotent.
-- ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_saved_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  staff_id     UUID REFERENCES staff(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  output_kind  TEXT,                 -- copy_variants | sns_queue | sourcing_brief …
  item_type    TEXT,                 -- copy | post | product | prompt | faq …
  payload      JSONB NOT NULL,       -- 저장된 항목 내용(카피 1개·게시물 1개 등)
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ssi_ws_staff_idx ON staff_saved_items(workspace_id, staff_id, created_at DESC);

ALTER TABLE staff_saved_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ssi_select ON staff_saved_items;
CREATE POLICY ssi_select ON staff_saved_items FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS ssi_insert ON staff_saved_items;
CREATE POLICY ssi_insert ON staff_saved_items FOR INSERT
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS ssi_delete ON staff_saved_items;
CREATE POLICY ssi_delete ON staff_saved_items FOR DELETE
  USING (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE staff_saved_items IS '직원 보관함 — 리포트 산출물 중 ⭐로 저장한 항목. output_kind별 전용 UI.';
