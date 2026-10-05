-- ────────────────────────────────────────────────────────
-- 061: snapshot 재확인 시각을 쓰기 가능한 pointer 테이블로 옮김
-- ────────────────────────────────────────────────────────
-- 배경: 060 에서 source_snapshots 를 **immutable**(SELECT + INSERT 정책만)로 만든 것은 의도대로다.
--   그런데 같은 마이그레이션이 그 테이블에 last_seen_at 을 두었고, 서비스 코드가 그 값을
--   UPDATE 하려 했다 → UPDATE 정책이 없어 RLS 가 조용히 막는다(에러 없이 0행).
--   계약 0.2.0 §7.3 도 "동일 digest 면 기존 bytes·기존 관찰 시각을 재사용하고
--   **마지막 재확인 시각은 별도 운영 메타데이터에 저장한다**" 고 적었다.
--   즉 원문 행에 재확인 시각을 쓰는 설계 자체가 계약과 어긋났다.
--
-- 이 마이그레이션이 하는 것:
--   ① source_snapshot_latest(쓰기 가능한 pointer)에 last_confirmed_at 추가 → 재확인 시각은 여기에 쓴다.
--   ② source_snapshots.last_seen_at 은 **수신 시점 값으로 고정**(insert 때만 채움)이라는 뜻으로 주석 정정.
--      컬럼은 지우지 않는다 — 이미 적용된 060 을 되돌리지 않고 가산적으로 보정한다.
--
-- 060 은 수정하지 않는다(CLAUDE.md: 적용된 마이그레이션은 새 번호로만 변경).
-- 적용: Supabase 대시보드 SQL 에디터. idempotent.
-- ────────────────────────────────────────────────────────

ALTER TABLE source_snapshot_latest
  ADD COLUMN IF NOT EXISTS last_confirmed_at TIMESTAMPTZ;

COMMENT ON COLUMN source_snapshot_latest.last_confirmed_at IS
  '같은 content_digest 를 다시 받아 "내용이 그대로임" 을 재확인한 마지막 시각(계약 0.2.0 §7.3의 운영 메타데이터). 새 revision 사유가 아니다.';

-- 기존 행 백필: pointer 가 가리키는 snapshot 의 수신 시각으로 초기화
UPDATE source_snapshot_latest l
   SET last_confirmed_at = s.received_at
  FROM source_snapshots s
 WHERE s.id = l.snapshot_pk
   AND l.last_confirmed_at IS NULL;

COMMENT ON COLUMN source_snapshots.last_seen_at IS
  '수신 시점에 기록하는 값(= received_at). 이 테이블은 immutable 이므로 이후 갱신하지 않는다. 재확인 시각은 source_snapshot_latest.last_confirmed_at 을 쓴다.';
