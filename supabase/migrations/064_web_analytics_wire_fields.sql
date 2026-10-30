-- ────────────────────────────────────────────────────────
-- 064: web_analytics 에 wire 필드 보존 (GPT-R3-O1)
-- ────────────────────────────────────────────────────────
-- 배경: GPT 통합 round3 §4 GPT-R3-O1 —
--   "toStorageRow() 가 원천의 query_version 을 버리고 schema_version 을 저장한다.
--    wire query_version=web-analytics.v1/2026-10-05 를 보존하고 조회/unique/revision scope 도 같이 고친다.
--    루트 source_data_through·content_digest 도 타입/검증/보관에 포함한다."
--
-- 062 는 이미 적용됐으므로 수정하지 않고 새 번호로 보강한다(CLAUDE.md 규칙).
--   · query_version 컬럼은 062 에 이미 있다. 이제 **wire 값**(질의본 식별자)이 들어간다.
--   · schema_version 을 따로 둬서 둘을 섞지 않는다.
--   · content_digest 는 원천이 계산한 **의미 digest** 다. 수신 bytes 해시(raw_sha256)와 다르다.p
--
-- 가산적·idempotent. 적용: Supabase 대시보드 SQL 에디터.
-- ────────────────────────────────────────────────────────

ALTER TABLE web_analytics ADD COLUMN IF NOT EXISTS schema_version TEXT;
ALTER TABLE web_analytics ADD COLUMN IF NOT EXISTS content_digest TEXT;

COMMENT ON COLUMN web_analytics.query_version IS
  '원천 wire 의 query_version 을 그대로 (예: web-analytics.v1/2026-10-05). 어떤 질의본인지 추적용. schema_version 과 다른 값일 수 있다.';
COMMENT ON COLUMN web_analytics.schema_version IS
  'wire 구조 버전(web-analytics.v1). query_version 과 섞지 않는다.';
COMMENT ON COLUMN web_analytics.content_digest IS
  '원천이 계산한 의미 digest. 수신 bytes 해시(raw_sha256)와 **다른 것**이다. 같은 digest 면 같은 local revision 을 재사용한다(GPT round3 §5).';

-- 기존 행 백필: 062 시절에는 query_version 에 schema_version 값이 들어갔다.
UPDATE web_analytics
   SET schema_version = COALESCE(schema_version, 'web-analytics.v1')
 WHERE schema_version IS NULL;

-- 같은 scope 에서 content_digest 를 빠르게 찾기 위한 인덱스 (local revision 발급에 쓴다)
CREATE INDEX IF NOT EXISTS web_analytics_digest_idx
  ON web_analytics(workspace_id, source_system, environment, usage, period_start, period_end, content_digest);
