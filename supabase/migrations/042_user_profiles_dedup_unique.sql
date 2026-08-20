-- ────────────────────────────────────────────────────────
-- 042: user_profiles 중복 정리 + user_id UNIQUE (프로필 저장 안 됨 버그 방어)
-- ────────────────────────────────────────────────────────
-- 배경: user_profiles가 '싱글 프로필'로 설계됐는데, upsert가 user_id로만 기존 행을 찾아
--   레거시 행(user_id NULL/불일치)을 못 찾고 중복 INSERT 하거나 UPDATE 0행 → "저장이 안 됨".
-- 코드(userProfile.service.upsertUserProfile)는 레거시 미할당 행을 흡수하도록 고쳤고,
--   이 마이그레이션은 이미 쌓인 중복을 정리하고 재발을 막는다.
-- ⚠️ 파괴적: user_id별 최신 1건만 남기고 나머지 삭제. 대시보드에서 아래 진단 후 실행 권장.
--   진단:  select id, user_id, name, created_at from user_profiles order by created_at;
-- 적용일: 2026-08-20. idempotent.
-- ────────────────────────────────────────────────────────

-- 1) user_id가 채워진 행 중 중복 제거 — user_id별 최신(updated_at, created_at) 1건만 유지
DELETE FROM user_profiles a
USING user_profiles b
WHERE a.user_id IS NOT NULL
  AND a.user_id = b.user_id
  AND a.id <> b.id
  AND (
    COALESCE(a.updated_at, a.created_at) < COALESCE(b.updated_at, b.created_at)
    OR (COALESCE(a.updated_at, a.created_at) = COALESCE(b.updated_at, b.created_at) AND a.id < b.id)
  );

-- 2) user_id가 채워진 행에 부분 UNIQUE 인덱스 (NULL 레거시 행은 코드가 흡수하므로 제외)
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_user_id_uniq
  ON user_profiles(user_id)
  WHERE user_id IS NOT NULL;
