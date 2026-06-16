-- ────────────────────────────────────────────────────────
-- 코인제 — 워크스페이스 코인 잔액 + 직원 실행 사용 로그
-- 설계: 직원이 일할 때마다 토큰 비용을 코인으로 환산해 차감 (1코인 = $0.001)
-- 적용일: 2026-06-16 · staff_output_actions(011) 이후 실행. idempotent.
-- ────────────────────────────────────────────────────────

-- 워크스페이스별 코인 잔액 (초기 10,000코인 ≈ $10)
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 10000;

-- 직원 실행 사용 로그 (어떤 직원이 어떤 모델로 얼마 썼나)
CREATE TABLE IF NOT EXISTS staff_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  staff_id      UUID REFERENCES staff(id) ON DELETE SET NULL,
  report_id     UUID REFERENCES daily_reports(id) ON DELETE SET NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  model         TEXT,                              -- 실행에 쓴 모델(StaffModel)
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  coins         INTEGER NOT NULL DEFAULT 0,        -- 차감된 코인
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS su_ws_idx     ON staff_usage(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS su_staff_idx  ON staff_usage(staff_id);

ALTER TABLE staff_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS su_select ON staff_usage;
CREATE POLICY su_select ON staff_usage FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS su_insert ON staff_usage;
CREATE POLICY su_insert ON staff_usage FOR INSERT
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

-- 코인 차감(원자적). 잔액은 0 밑으로 안 내려감.
CREATE OR REPLACE FUNCTION deduct_credits(ws_id UUID, amount INTEGER)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE next_balance INTEGER;
BEGIN
  UPDATE workspaces SET credits = GREATEST(0, credits - amount)
  WHERE id = ws_id
  RETURNING credits INTO next_balance;
  RETURN next_balance;
END; $$;

COMMENT ON COLUMN workspaces.credits IS '코인 잔액. 직원 실행 시 토큰 비용만큼 차감 (1코인=$0.001).';
COMMENT ON TABLE staff_usage IS '직원 실행별 토큰·코인 사용 로그.';
