-- 021_schedule_plans.sql
-- 일정 메뉴 "플랜(roll-out plan)" 지원
-- 레퍼런스: docs/guides/시목-오픈-스케줄러.html (D-day 프로젝트 + 주차별 체크리스트 + 마일스톤 + 카테고리)
--
-- 1) schedule_plans : 하나의 플랜(예: "시목 오픈") — 목표일(D-day)·목표·주차(phase) 정의
-- 2) schedules 확장 : 완료체크 / 마일스톤 / 플랜 연결 / 주차 / 정렬 / 생성주체(수동·AI)
--
-- 적용: Supabase 대시보드 SQL 에디터에서 수동 실행 (db push 안 씀). 존재 안전(idempotent).

-- ─────────────────────────────────────────────
-- 1) schedule_plans 테이블
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.schedule_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id  uuid,                          -- NULL = 개인 플랜, 값 있으면 오피스 공유
  name          text NOT NULL,                 -- 예: "시목 오픈 스케줄러"
  emoji         text,                          -- 예: "木"
  goal          text,                          -- 예: "방문 30명+"
  description   text,                          -- 부제/설명
  target_date   date,                          -- D-day (예: 2026-07-25 오픈)
  start_date    date,                          -- 플랜 시작일 (예: 2026-06-25 이사)
  -- 주차/단계 정의 [{ "key":"0", "tag":"WEEK 0", "name":"이사 & 첫 콘텐츠" }, ...]
  phases        jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- 카테고리 정의 [{ "key":"content", "label":"숏폼", "color":"#9a6b43" }, ...]  (비우면 앱 기본값)
  categories    jsonb NOT NULL DEFAULT '[]'::jsonb,
  status        text NOT NULL DEFAULT 'active', -- active | done | archived
  generated_by  text NOT NULL DEFAULT 'manual', -- manual | ai
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_plans_user      ON public.schedule_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_plans_workspace ON public.schedule_plans(workspace_id);

ALTER TABLE public.schedule_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedule_plans owner" ON public.schedule_plans;
CREATE POLICY "schedule_plans owner" ON public.schedule_plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 2) schedules 확장 (테이블이 있을 때만)
-- ─────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.schedules') IS NOT NULL THEN
    -- 완료 체크 (체크리스트)
    ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS completed      boolean NOT NULL DEFAULT false;
    ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS completed_at   timestamptz;
    -- 절대 놓치면 안 되는 마감(마일스톤)
    ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS is_milestone   boolean NOT NULL DEFAULT false;
    -- 플랜 연결 + 주차(phase) + 같은 날 정렬 순서
    ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS plan_id        uuid REFERENCES public.schedule_plans(id) ON DELETE SET NULL;
    ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS phase          text;
    ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS sort_order     integer NOT NULL DEFAULT 0;
    -- 생성 주체: manual | ai | <staff_id>  (AI 자동 생성 일정 구분 표시용)
    ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS generated_by   text NOT NULL DEFAULT 'manual';

    CREATE INDEX IF NOT EXISTS idx_schedules_plan ON public.schedules(plan_id);
  END IF;
END $$;
