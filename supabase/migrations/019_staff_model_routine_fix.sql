-- ────────────────────────────────────────────────────────
-- AI 직원 채용/일과 버그 수정
-- 1) staff.model CHECK가 sonnet/haiku만 허용 → research/gpt/opus 직원 채용 실패
-- 2) staff_routines에 요일/날짜 컬럼 없음 + monthly 미허용 → 주간(요일)·월간 일정 저장 실패
-- 적용일: 2026-06-17 · 대시보드 SQL 에디터에서 실행
-- ────────────────────────────────────────────────────────

-- 1) 모델: 모든 직원 모델 허용
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_model_check;
ALTER TABLE staff ADD CONSTRAINT staff_model_check
  CHECK (model IN ('sonnet','haiku','opus','gpt','research'));

-- 2) 일과: 요일/날짜 컬럼 + monthly 주기 허용
ALTER TABLE staff_routines ADD COLUMN IF NOT EXISTS day_of_week  INT;  -- 0(일)~6(토), weekly용
ALTER TABLE staff_routines ADD COLUMN IF NOT EXISTS day_of_month INT;  -- 1~31, monthly용
ALTER TABLE staff_routines DROP CONSTRAINT IF EXISTS staff_routines_schedule_check;
ALTER TABLE staff_routines ADD CONSTRAINT staff_routines_schedule_check
  CHECK (schedule IN ('realtime','daily','weekly','monthly'));
