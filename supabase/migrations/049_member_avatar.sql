-- ────────────────────────────────────────────────────────
-- 049: workspace_members 프로필 이미지(avatar_url) 비정규화
-- ────────────────────────────────────────────────────────
-- 배경: 멤버끼리 서로의 프로필 이미지를 보려면 user_profiles를 읽어야 하는데,
-- user_profiles RLS는 본인 것만 읽게 돼 있다. user_profiles 전체를 팀에 노출하는 대신,
-- '나' 프로필 저장 시 이미지 URL만 workspace_members(멤버는 서로 읽기 가능)에 복사한다.
-- idempotent.

alter table workspace_members add column if not exists avatar_url text;
