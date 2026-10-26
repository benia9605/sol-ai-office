-- 065 를 돌리기 전에 - 이 오피스 DB 에 앞 단계(060 · 062)가 들어가 있는지만 본다. 읽기만 한다.
-- 결과 네 칸이 모두 true 면 065 로 넘어간다. 하나라도 false 면 그 줄을 본부에 알려 준다.
select
  to_regclass('public.ingest_credentials') is not null                          as "060 본부 토큰 표",
  exists (select 1 from information_schema.columns
          where table_name = 'workspaces' and column_name = 'office_shell')      as "062 오피스 모양 칸",
  to_regprocedure('public.my_workspace_ids()') is not null                     as "멤버 확인 함수",
  to_regclass('public.hq_briefings') is null                                    as "065 아직 안 돌림";
