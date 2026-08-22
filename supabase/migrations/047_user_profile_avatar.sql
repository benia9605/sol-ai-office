-- ────────────────────────────────────────────────────────
-- 047: user_profiles 프로필 이미지(avatar_url)
-- ────────────────────────────────────────────────────────
-- 배경: 프로필 이름·이미지를 '나' 메뉴에서 관리하고, 이름 앞에 아바타(이미지 또는 첫 글자)를
-- 보여준다. 이미지는 기존 public 'uploads' 버킷을 재사용하고 URL만 저장한다.
-- idempotent: ADD COLUMN IF NOT EXISTS.

alter table user_profiles add column if not exists avatar_url text;
