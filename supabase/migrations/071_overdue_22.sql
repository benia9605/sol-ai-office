-- ────────────────────────────────────────────────────────
-- 071: 미완료 알림을 설정 화면 안내대로 밤 10시(KST)에 - 2026-10-27 대표 실행
-- ────────────────────────────────────────────────────────
-- 2026-10-27 확인: overdue-tasks 예약이 '5 15 * * *' = 밤 12시 5분 (KST) 이었다. 화면에는 「밤 10시」.
-- 밤 10시 = UTC 13:00. 오늘 못 끝낸 일을 그날 밤에 알려 준다. 여러 번 돌려도 안전.
select cron.alter_job(jobid, schedule := '0 13 * * *') from cron.job where jobname = 'overdue-tasks';
-- 확인: select jobname, schedule from cron.job order by jobname;   → overdue-tasks | 0 13 * * *
