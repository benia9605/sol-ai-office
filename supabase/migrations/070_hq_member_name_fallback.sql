-- ────────────────────────────────────────────────────────
-- 070: 이름이 「멤버」 로 나오지 않게 - 그 워크스페이스 닉네임이 비면 같은 사람의 다른 워크스페이스 닉네임 - 2026-10-27 대표 실행
-- ────────────────────────────────────────────────────────
-- 배경 (2026-10-27): 쏠닝포인트 · 운명랩 워크스페이스는 쏠닝 닉네임이 비어 있어
--   본부 보고서 댓글 · 완료한 사람이 「멤버」 로 남았다 (시목에서는 「Sol」).
--   → 닉네임 순서: 그 워크스페이스 → 같은 사람의 다른 워크스페이스(가장 최근에 들어간 곳) → 「멤버」
-- 함수 하나만 바꾼다 (068 의 hq_member_name). 여러 번 돌려도 안전.

create or replace function hq_member_name(p_ws uuid, p_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(trim(m.nickname), '') from workspace_members m where m.workspace_id = p_ws and m.user_id = p_uid),
    (select nullif(trim(m.nickname), '') from workspace_members m
      where m.user_id = p_uid and nullif(trim(m.nickname), '') is not null order by m.joined_at desc limit 1),
    case when p_uid is not null then '멤버' end)
$$;
revoke all on function hq_member_name(uuid, uuid) from public;
