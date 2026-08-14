-- ────────────────────────────────────────────────────────
-- 031: 회사 기억(company_memory) — 비정형 지식 창구 (MVP)
-- ────────────────────────────────────────────────────────
-- 목표: 대표가 30초 안에 회사의 기억을 남기고 다시 찾는다.
-- ⛔ 제외(이번 Phase): embedding·pgvector·자동추출·대화요약 승격·AI 자동저장·
--    decisions/content/signals FK·Context Engine·자동병합·사용횟수/decay.
-- 기존 insights 자동 이전 안 함.
-- 적용일: 2026-08-05. idempotent. (수동 SQL 에디터 적용)
-- ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS company_memory (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind         TEXT CHECK (kind IN ('idea','insight','philosophy','failure','experiment','reference','competitor','ceo_memo')),
  title        TEXT NOT NULL,
  body         TEXT,
  summary      TEXT,                          -- 카드 표시용(대표가 직접 입력 · AI 자동요약 아님)
  tags         TEXT[],
  salience     INTEGER DEFAULT 50,            -- 중요도(0~100)
  pinned       BOOLEAN DEFAULT false,         -- 고정(항상 상단)
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_memory_ws_idx ON company_memory(workspace_id, pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS company_memory_kind_idx ON company_memory(workspace_id, kind);

ALTER TABLE company_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_memory_select ON company_memory;
CREATE POLICY company_memory_select ON company_memory FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS company_memory_insert ON company_memory;
CREATE POLICY company_memory_insert ON company_memory FOR INSERT
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS company_memory_update ON company_memory;
CREATE POLICY company_memory_update ON company_memory FOR UPDATE
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS company_memory_delete ON company_memory;
CREATE POLICY company_memory_delete ON company_memory FOR DELETE
  USING (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE company_memory IS '회사 기억 — 비정형 지식(아이디어/깨달음/철학/실패/실험/레퍼런스/경쟁사/대표메모). 30초 입력·검색 MVP.';
