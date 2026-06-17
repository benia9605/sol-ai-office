-- ────────────────────────────────────────────────────────
-- 외부 앱(운명랩·시목 등) → 오피스 KPI 수신 테이블
-- 구조: 각 앱이 매일 자기 KPI를 오피스 Supabase로 PUSH(kpi-ingest 엣지펑션) →
--       오피스 대시보드는 이 테이블만 읽음(워크스페이스별).
-- 적용일: 2026-06-18 · 대시보드 SQL 에디터에서 실행
-- ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS external_kpis (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source          TEXT NOT NULL,            -- 'unmyunglab' | 'simok' | ...
  date            DATE NOT NULL,
  revenue         NUMERIC,                  -- 매출(원)
  orders          INTEGER,                  -- 주문/결제 수
  visitors        INTEGER,                  -- 방문자 수
  conversion_rate NUMERIC,                  -- 전환율(%)
  inquiries       INTEGER,                  -- 신규 문의 수
  extra           JSONB,                    -- 도메인별 추가 지표(자유)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, source, date)
);

CREATE INDEX IF NOT EXISTS external_kpis_ws_date_idx ON external_kpis(workspace_id, date DESC);

-- RLS: 워크스페이스 멤버는 읽기만. 쓰기는 kpi-ingest 엣지펑션(service_role)만 → 클라이언트 insert 정책 없음(차단)
ALTER TABLE external_kpis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS external_kpis_select ON external_kpis;
CREATE POLICY external_kpis_select ON external_kpis FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE external_kpis IS '외부 앱이 PUSH한 일일 KPI (오피스 대시보드 표시용)';
