-- ────────────────────────────────────────────────────────
-- 060: 시목 연동 가드 — provider 차단 · ERP 연결 scope · 수신 자격증명
-- ────────────────────────────────────────────────────────
-- 배경: 공유 폴더 계약 0.2.0(proposed) §2·§9 와 GPT 통합 회신의 작업카드 GPT-R1-O1 / INT-009.
--   ① erp-proxy 가 "로그인한 아무 유저나" 시목 ERP 전체를 읽을 수 있었다(workspace 검사 없음).
--      SIMOK_API_KEY 는 이미 등록돼 있고 erp-proxy 는 배포 상태라 **실제로 열려 있던 구멍**이다.
--      함수 쪽 가드는 호출자 JWT + RLS 로 멤버십을 증명하게 고쳤고(코드), 이 마이그레이션은
--      "어느 workspace 가 어떤 원천에 연결되는가"를 데이터로 고정한다.
--   ② D-007: 시목 workspace 에서 Office 서버가 모델 API(provider)를 호출하지 않게 **서버 정책**으로 막는다.
--      UI 숨김만으로는 부족하다는 계약 §9 요구. 다른 브랜드의 기존 AI 기능은 그대로 둔다.
--   ③ kpi-ingest 가 전역 토큰 1개 + 요청 본문의 workspaceId 를 신뢰했다 → 토큰 보유자가
--      아무 workspace 에나 쓸 수 있었다. 토큰 해시 → workspace + scope 매핑으로 바꾼다.
--      기존 전송자(운명랩)를 끊지 않도록 legacy 플래그로 점진 전환한다.
--
-- 이 마이그레이션은 전부 가산적(additive)이고 idempotent 하다. 기존 동작을 깨지 않는다.
-- 적용: Supabase 대시보드 SQL 에디터에서 위→아래 순서로 검토 후 실행 (db push 안 씀).
-- ────────────────────────────────────────────────────────

-- ── ① ERP 연결 scope: 브랜드 표시 이름 문자열 비교를 코드에서 없애기 위한 설정 ──
-- 기존 products.service.ts 가 business_entity='시목' 을 하드코딩하고 있었다.
-- 계약 §2: "브랜드 표시 이름 문자열로 분기하지 않고 안정적인 ID/기존 식별 설정을 사용한다."
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS erp_business_entity TEXT;
COMMENT ON COLUMN workspaces.erp_business_entity IS
  'ERP 원천에서 이 워크스페이스에 해당하는 사업자/법인 식별값. erp_source=simok_api 일 때 /products 의 business_entity 로 전달. 코드 하드코딩 금지.';

-- ── ② D-007: 워크스페이스별 모델 provider 호출 허용 여부 (서버 정책) ──
-- 기본 true → 다른 브랜드(운명랩·쏠닝오즈)의 기존 AI 기능은 영향 없음.
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS ai_provider_enabled BOOLEAN NOT NULL DEFAULT TRUE;
COMMENT ON COLUMN workspaces.ai_provider_enabled IS
  'D-007: false 면 서버가 이 워크스페이스에 대한 모델 API(provider) 호출을 거절한다. cron·수동 직원 실행·이미지·채팅 전부 동일 정책. UI 숨김과 별개의 서버 게이트.';

-- 시목 워크스페이스를 차단한다. ★ 이름이 아니라 "ERP 연결이 켜진 워크스페이스" 라는 정책으로 고른다
--   (표시 이름 '시목' 에 의존하지 않고, 운영 UUID 를 git 에 넣지도 않는다).
UPDATE workspaces
   SET ai_provider_enabled = FALSE,
       erp_business_entity = COALESCE(erp_business_entity, name)
 WHERE erp_source = 'simok_api'
   AND ai_provider_enabled IS DISTINCT FROM FALSE;

-- 되돌리려면(대표 판단으로 시목에 모델 실행을 다시 허용할 때):
--   UPDATE workspaces SET ai_provider_enabled = TRUE WHERE id = '<시목 workspace uuid>';

-- ── ③ 수신 자격증명: 토큰 해시 → workspace + scope ──
-- 평문 토큰은 저장하지 않는다(sha256 hex 만). 발급·회전·폐기는 이 표의 행으로 관리한다.
CREATE TABLE IF NOT EXISTS ingest_credentials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,                 -- 'simok-app' | 'unmyunglab' 등 사람이 읽는 식별
  token_sha256  TEXT NOT NULL UNIQUE,          -- lower(hex(sha256(평문))). 평문은 서버 secret 에만
  scopes        TEXT[] NOT NULL DEFAULT ARRAY['snapshots:ingest']::TEXT[],
  source_system TEXT,                          -- 이 자격증명이 보낼 수 있는 원천 이름(선택 고정)
  environment   TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('demo','staging','production')),
  usage         TEXT NOT NULL DEFAULT 'validation' CHECK (usage IN ('validation','operational')),
  -- legacy=true 면 body.workspaceId 를 허용하되 **이 행의 workspace_id 와 정확히 같을 때만** 통과시킨다.
  -- 계약 §2 의 legacy adapter. 기존 전송자를 즉시 끊지 않고 점진 전환한다.
  legacy_body_workspace BOOLEAN NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ingest_credentials_ws_idx ON ingest_credentials(workspace_id) WHERE is_active;

-- demo/staging 은 validation 만 허용 (계약 §2)
ALTER TABLE ingest_credentials DROP CONSTRAINT IF EXISTS ingest_credentials_env_usage_chk;
ALTER TABLE ingest_credentials ADD CONSTRAINT ingest_credentials_env_usage_chk
  CHECK (environment = 'production' OR usage = 'validation');

ALTER TABLE ingest_credentials ENABLE ROW LEVEL SECURITY;
-- 멤버는 "어떤 자격증명이 있는지"만 볼 수 있다. 토큰 해시 노출을 막기 위해 쓰기 정책은 두지 않는다
-- (발급·폐기는 service_role 또는 SQL 에디터에서 수행).
DROP POLICY IF EXISTS ingest_credentials_select ON ingest_credentials;
CREATE POLICY ingest_credentials_select ON ingest_credentials FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE ingest_credentials IS
  '외부 앱 → Office 수신 자격증명. 토큰은 sha256 해시만 저장. workspace 는 이 행이 결정하고 요청 본문은 신뢰하지 않는다(계약 0.2.0 §2).';

-- ── ④ 영속 snapshot 저장소 (계약 0.2.0 §7) ──
-- 논리 scope = (workspace_id, source_system, environment, usage, business_date, schema_version)
-- 원문 bytes·sha256·수신시각·revision·quality 를 보존하고, UI 는 projection 을 읽는다.
CREATE TABLE IF NOT EXISTS source_snapshots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_system  TEXT NOT NULL,
  environment    TEXT NOT NULL CHECK (environment IN ('demo','staging','production')),
  usage          TEXT NOT NULL CHECK (usage IN ('validation','operational')),
  business_date  DATE NOT NULL,
  schema_version TEXT NOT NULL,                -- ★ 정확한 버전('0.2.0'). major 만으로 섞지 않는다(§7)
  revision       INTEGER NOT NULL CHECK (revision >= 1),

  snapshot_id    TEXT NOT NULL,                -- 원천이 붙인 id. 전역 고유로 가정하지 않는다(§7)
  raw_body       JSONB NOT NULL,               -- 받은 원문(변경 금지)
  raw_sha256     TEXT NOT NULL,                -- 수신 bytes 해시 — 중복 판단·감사용
  content_digest TEXT NOT NULL,                -- §7.3 canonical digest(관찰시각 제외) — 내용 변경 감지용
  generated_at      TIMESTAMPTZ NOT NULL,
  source_updated_at TIMESTAMPTZ,
  received_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),  -- 같은 digest 재확인 시각(새 revision 아님)
  quality        JSONB,                        -- commerce/products/inventory/traffic 상태 요약
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- 같은 scope+revision 은 1행 (동시 생성 방지 · §7.6)
  UNIQUE (workspace_id, source_system, environment, usage, business_date, schema_version, revision)
);
CREATE INDEX IF NOT EXISTS source_snapshots_scope_idx
  ON source_snapshots(workspace_id, environment, usage, business_date DESC, revision DESC);
CREATE INDEX IF NOT EXISTS source_snapshots_hash_idx ON source_snapshots(workspace_id, raw_sha256);

ALTER TABLE source_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS source_snapshots_select ON source_snapshots;
CREATE POLICY source_snapshots_select ON source_snapshots FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
-- 쓰기: 멤버가 수동 import(파일)할 수 있어야 하므로 insert 허용. 수정·삭제는 막는다(immutable).
DROP POLICY IF EXISTS source_snapshots_insert ON source_snapshots;
CREATE POLICY source_snapshots_insert ON source_snapshots FOR INSERT
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE source_snapshots IS
  '원천 하루 snapshot 의 영속 보관(계약 0.2.0 §7). 원문 immutable + raw_sha256 + content_digest + revision. UI 는 latest pointer/projection 을 읽는다.';

-- latest pointer: scope 당 최신 revision 1행. 낮은 revision 이 늦게 와도 내려가지 않는다(§7.5).
CREATE TABLE IF NOT EXISTS source_snapshot_latest (
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_system  TEXT NOT NULL,
  environment    TEXT NOT NULL,
  usage          TEXT NOT NULL,
  business_date  DATE NOT NULL,
  schema_version TEXT NOT NULL,
  revision       INTEGER NOT NULL,
  snapshot_pk    UUID NOT NULL REFERENCES source_snapshots(id) ON DELETE CASCADE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, source_system, environment, usage, business_date, schema_version)
);
ALTER TABLE source_snapshot_latest ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ssl_select ON source_snapshot_latest;
CREATE POLICY ssl_select ON source_snapshot_latest FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS ssl_write ON source_snapshot_latest;
CREATE POLICY ssl_write ON source_snapshot_latest FOR ALL
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE source_snapshot_latest IS
  'scope 당 최신 revision pointer. 낮은 revision 이 늦게 도착해도 되돌리지 않는다(계약 0.2.0 §7.5).';

-- ── ⑤ 수신 실패·불완전 기록 (계약 §8: 에러를 빈 배열/0 매출로 바꾸지 않는다) ──
CREATE TABLE IF NOT EXISTS source_ingest_errors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_system TEXT,
  business_date DATE,
  environment   TEXT,
  usage         TEXT,
  code          TEXT NOT NULL,          -- validation_failed | conflict | upstream_timeout | incomplete_page | ...
  message       TEXT NOT NULL,
  retryable     BOOLEAN NOT NULL DEFAULT FALSE,
  trace_id      TEXT,
  raw_sha256    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS source_ingest_errors_ws_idx ON source_ingest_errors(workspace_id, created_at DESC);
ALTER TABLE source_ingest_errors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sie_select ON source_ingest_errors;
CREATE POLICY sie_select ON source_ingest_errors FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS sie_insert ON source_ingest_errors;
CREATE POLICY sie_insert ON source_ingest_errors FOR INSERT
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE source_ingest_errors IS
  '수신·검증 실패와 불완전(page cap) 기록. 연결 상태 화면이 읽는다. 실패를 0이나 빈 배열로 숨기지 않기 위한 원장.';
