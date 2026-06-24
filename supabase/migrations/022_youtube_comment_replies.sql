-- ────────────────────────────────────────────────────────
-- 022: 유튜브 댓글에 "기존 답글" 저장 (내 답글 + 다른 사람 답글 모두)
-- 배경: 수집 시 commentThreads/comments.list로 답글까지 가져오는데,
--       저장할 곳이 없어 버려졌고 reply_status도 'none'으로 하드코딩돼
--       "이미 답글 단 댓글이 죄다 미답글로 보이는" 문제가 있었음.
-- 해결: replies(JSONB) + reply_count 컬럼 추가. 수집한 답글 전량을 보존.
--   replies 예: [{ commentId, author, authorThumbnail, text, publishedAt, likeCount, isOwner }]
-- 적용: Supabase 대시보드 SQL 에디터에서 수동 실행. idempotent.
-- ────────────────────────────────────────────────────────

ALTER TABLE youtube_comments ADD COLUMN IF NOT EXISTS replies     JSONB;
ALTER TABLE youtube_comments ADD COLUMN IF NOT EXISTS reply_count INTEGER;
