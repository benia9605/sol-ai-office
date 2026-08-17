-- ────────────────────────────────────────────────────────
-- 034: CS 응대 — 문의 티켓(tickets) + FAQ 라이브러리(cs_faq)
-- ────────────────────────────────────────────────────────
-- 배경(GPT 설계 v2): CS는 콘텐츠 제작이 아니라 '운영 업무'라 앱에 남긴다.
--   문의를 티켓으로 쌓고 → 유형·긴급도·감정 분류 + 답변 초안 → (민감건) 대표 승인 → FAQ 축적.
--   반복 문의는 FAQ로 승격, 다음 문의에서 AI가 FAQ를 먼저 참고. customer_signal은 콘텐츠 아이디어로.
-- 이 마이그레이션이 하는 것:
--   1) tickets — 문의 1건. 원문·분류·초안·상태. 원본은 시목앱/채널이지만 지금은 수기 붙여넣기.
--   2) cs_faq — 자주 묻는 질문/답변 라이브러리(원목·도마·가구·배송·재고·A/S).
-- 원칙: 실제 채널 자동수집·발송은 2차. 1차는 붙여넣기+분류+초안+FAQ.
-- 적용일: 2026-08-17. idempotent. (수동 SQL 에디터 적용)
-- ────────────────────────────────────────────────────────

-- 1) 문의 티켓
CREATE TABLE IF NOT EXISTS tickets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  channel        TEXT NOT NULL DEFAULT 'other',    -- smartstore|selfmall|instagram|phone|showroom|other
  customer_name  TEXT,
  order_ref      TEXT,
  product_id     UUID,                              -- products 참조(느슨) · 없을 수 있음
  original_text  TEXT NOT NULL,
  category       TEXT NOT NULL DEFAULT 'other',     -- shipping|product|stock|care|as|exchange|refund|order|other
  urgency        TEXT NOT NULL DEFAULT 'normal',    -- low|normal|high|critical
  sentiment      TEXT NOT NULL DEFAULT 'neutral',   -- positive|neutral|negative
  status         TEXT NOT NULL DEFAULT 'new',       -- new|drafted|waiting_approval|answered|hold|closed
  ai_draft       TEXT,
  final_answer   TEXT,
  needs_approval BOOLEAN NOT NULL DEFAULT false,
  faq_candidate  BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS tickets_ws_status_idx ON tickets(workspace_id, status, created_at DESC);

-- 2) FAQ 라이브러리
CREATE TABLE IF NOT EXISTS cs_faq (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category     TEXT NOT NULL DEFAULT 'other',
  question     TEXT NOT NULL,
  answer       TEXT,
  occurrences  INTEGER NOT NULL DEFAULT 1,          -- 반복 문의 횟수
  status       TEXT NOT NULL DEFAULT 'active',      -- active|archived
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cs_faq_ws_idx ON cs_faq(workspace_id);

-- RLS (오피스 공용 — my_workspace_ids)
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_faq  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tickets_select ON tickets;
CREATE POLICY tickets_select ON tickets FOR SELECT USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS tickets_insert ON tickets;
CREATE POLICY tickets_insert ON tickets FOR INSERT WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS tickets_update ON tickets;
CREATE POLICY tickets_update ON tickets FOR UPDATE USING (workspace_id IN (SELECT my_workspace_ids())) WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS tickets_delete ON tickets;
CREATE POLICY tickets_delete ON tickets FOR DELETE USING (workspace_id IN (SELECT my_workspace_ids()));

DROP POLICY IF EXISTS cs_faq_select ON cs_faq;
CREATE POLICY cs_faq_select ON cs_faq FOR SELECT USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS cs_faq_insert ON cs_faq;
CREATE POLICY cs_faq_insert ON cs_faq FOR INSERT WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS cs_faq_update ON cs_faq;
CREATE POLICY cs_faq_update ON cs_faq FOR UPDATE USING (workspace_id IN (SELECT my_workspace_ids())) WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS cs_faq_delete ON cs_faq;
CREATE POLICY cs_faq_delete ON cs_faq FOR DELETE USING (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE tickets IS 'CS 문의 티켓(채널·분류·초안·상태). 원본은 채널이지만 1차는 수기 붙여넣기.';
COMMENT ON TABLE cs_faq IS 'CS FAQ 라이브러리 — 반복 문의를 승격. AI 답변 초안이 먼저 참고.';
