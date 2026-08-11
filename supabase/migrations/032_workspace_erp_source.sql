-- ────────────────────────────────────────────────────────
-- 워크스페이스별 ERP 데이터 소스 — 시목 ERP를 '해당 워크스페이스에만' 연결
-- 'manual'      = Compatibility Mode (AI Office 임시 수기 입력)  ← 기본
-- 'simok_api'   = 시목앱 ERP 조회 (제품·매출 읽기 전용)
-- 연결/해제 = 이 컬럼 한 줄 UPDATE (리빌드 불필요).
-- 적용일: 2026-08-11. idempotent.
-- ────────────────────────────────────────────────────────

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS erp_source TEXT NOT NULL DEFAULT 'manual';

COMMENT ON COLUMN workspaces.erp_source IS 'ERP 데이터 소스: manual(수기) | simok_api(시목앱 조회). 워크스페이스 단위.';

-- 시목 워크스페이스를 시목 ERP에 연결하려면(배포·시크릿 준비 후):
--   UPDATE workspaces SET erp_source = 'simok_api' WHERE name = '시목';
-- 되돌리려면:
--   UPDATE workspaces SET erp_source = 'manual' WHERE name = '시목';
