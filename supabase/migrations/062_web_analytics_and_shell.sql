-- ────────────────────────────────────────────────────────
-- 062: 방문·유입 집계 보관(WEB-O1) + 워크스페이스 전용 셸 설정(DESIGN-O1)
-- ────────────────────────────────────────────────────────
-- 배경(공유 폴더):
--   · 10_WEB_ANALYTICS_PLAN.md §5 — GA 관측 집계와 내부 주문 유입 연결을 **판매 snapshot 과 별도**
--     `web-analytics.v1` 레코드로 보관한다. 0.2.0 돈 계약의 traffic placeholder 를 늘리지 않는다.
--   · 11_SIMOK_OFFICE_BUILD_PACK.md §2 — 전용 셸 선택은 "신뢰되는 설정의 workspace ID 매핑" 으로 한다.
--     표시 이름 '시목' 문자열이나 클라이언트가 바꿀 수 있는 값으로 분기하지 않는다.
--
-- 전부 가산적이고 idempotent. 기존 동작을 깨지 않는다.
-- 적용: Supabase 대시보드 SQL 에디터 (db push 안 씀).
-- ────────────────────────────────────────────────────────

-- ── ① 워크스페이스 전용 셸 ──
-- UI 분기용 설정이다. **권한과 무관**하다 — 데이터 접근은 RLS·서버 가드가 결정한다.
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS office_shell TEXT;
COMMENT ON COLUMN workspaces.office_shell IS
  'UI 전용 셸 키. NULL=공통 OfficeShell, ''simok''=시목 전용 셸. 표시 분기용이며 권한·데이터 접근과 무관(마이그 062).';

-- ERP 연결이 켜진 워크스페이스에 시목 셸을 붙인다(표시 이름에 의존하지 않는 정책 기반 선택).
UPDATE workspaces
   SET office_shell = 'simok'
 WHERE erp_source = 'simok_api'
   AND office_shell IS NULL;

-- 되돌리려면: UPDATE workspaces SET office_shell = NULL WHERE id = '<uuid>';

-- ── ② 방문·유입 집계 레코드 (web-analytics.v1) ──
-- 한 행 = 한 기간의 집계 1건. 계약 0.2.0 의 snapshot 과 **다른 묶음**이다.
-- 10 문서 §5 의 "한 분석 레코드에 최소 필요한 것" 을 컬럼으로 옮겼다.
CREATE TABLE IF NOT EXISTS web_analytics (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- scope: workspace 는 서버가 부여하고 environment/usage 는 원천이 보낸다(계약 §2 와 같은 규칙)
  source_system  TEXT NOT NULL,            -- 원천 이름('simok_app'). 권한 증명이 아니라 출처 표기
  environment    TEXT NOT NULL CHECK (environment IN ('demo','staging','production')),
  usage          TEXT NOT NULL CHECK (usage IN ('validation','operational')),
  currency       TEXT NOT NULL DEFAULT 'KRW',

  -- 정확한 기간 (KST 양끝 포함). 최대 31일은 앱에서 검증한다.
  period_start   DATE NOT NULL,
  period_end     DATE NOT NULL,
  timezone       TEXT NOT NULL DEFAULT 'Asia/Seoul',

  query_version  TEXT NOT NULL,            -- 'web-analytics.v1'
  source_ref     TEXT,                     -- GA property 연결 참조(식별자 아님, 연결 이름)
  observed_at         TIMESTAMPTZ NOT NULL, -- 집계를 조회한 시각
  source_data_through TIMESTAMPTZ,          -- 원천이 "여기까지 처리됨" 이라 알려준 시점
  collection_started_at DATE,               -- 수집 시작일. 이 이전 기간을 0 으로 채우지 않기 위함

  -- GA4 는 처리 중 값이 바뀐다 → 잠정/재조회를 구별 (10 문서 §5)
  freshness      TEXT NOT NULL DEFAULT 'provisional' CHECK (freshness IN ('provisional','rechecked')),
  revision       INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  raw_sha256     TEXT,                     -- 수신 원문 bytes 해시
  raw_body_text  TEXT,                     -- ★ 수신 원문 그대로(TEXT). JSONB 는 키순서·공백을 잃어
                                           --   원문 SHA 재계산이 불가능하다(GPT-R2-O3 의 지적을 여기에도 적용)

  -- ★ GA 관측 블록과 내부 주문 블록을 **분리 보관**한다 (10 문서 §5)
  --   섞어서 전환율을 만들지 않기 위해 구조부터 나눈다.
  ga_metrics     JSONB,                    -- {totalUsers, sessions, screenPageViews, quality:{...}}
  ga_breakdown   JSONB,                    -- {sources:[...], events:[...], landing:[...]}
  order_metrics  JSONB,                    -- {webPaidOrders, attributedOrders, byContent:[...], unattributedReasons:{...}}
  attribution    JSONB,                    -- {model:'last_eligible_touch_30d_v1', lookbackDays:30, ledgerSnapshotRef}
  quality        JSONB,                    -- 블록·필드별 상태와 이유
  limitations    TEXT[],                   -- thresholding/sampling/(other)/quota/지연 등

  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  received_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 같은 scope·기간·query_version·revision 은 1행 (같은 사용자 기간 중복 방지 — WEB-O1)
  UNIQUE (workspace_id, source_system, environment, usage, period_start, period_end, query_version, revision)
);

CREATE INDEX IF NOT EXISTS web_analytics_scope_idx
  ON web_analytics(workspace_id, environment, usage, period_end DESC, revision DESC);

-- demo/staging 은 validation 만 (계약 §2 와 동일 규칙)
ALTER TABLE web_analytics DROP CONSTRAINT IF EXISTS web_analytics_env_usage_chk;
ALTER TABLE web_analytics ADD CONSTRAINT web_analytics_env_usage_chk
  CHECK (environment = 'production' OR usage = 'validation');

-- 기간이 뒤집히지 않게
ALTER TABLE web_analytics DROP CONSTRAINT IF EXISTS web_analytics_period_chk;
ALTER TABLE web_analytics ADD CONSTRAINT web_analytics_period_chk
  CHECK (period_end >= period_start);

ALTER TABLE web_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS web_analytics_select ON web_analytics;
CREATE POLICY web_analytics_select ON web_analytics FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS web_analytics_insert ON web_analytics;
CREATE POLICY web_analytics_insert ON web_analytics FOR INSERT
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
-- 정정은 새 revision 으로 넣는다 → UPDATE/DELETE 정책을 두지 않는다(immutable).

COMMENT ON TABLE web_analytics IS
  '방문·유입 집계 보관(web-analytics.v1). GA 관측 블록과 내부 주문 유입 블록을 분리 저장. 판매 snapshot(0.2.0)과 별도 묶음. 정정은 새 revision.';

-- ── ③ 콘텐츠 ↔ 유입 링크 등록부 ──
-- 10 문서 §4: utm_content 에 **Office 콘텐츠 레코드 ID** 를 쓴다. 임의 문장·이모지·고객정보 금지.
-- 같은 게시물을 재배포하면 placement 로 구별한다.
CREATE TABLE IF NOT EXISTS content_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  content_item_id UUID REFERENCES content_items(id) ON DELETE SET NULL,
  placement       TEXT NOT NULL DEFAULT 'default',  -- 재배포 구별 키

  utm_source      TEXT NOT NULL,     -- instagram | threads | naver_blog | newsletter | showroom_qr …
  utm_medium      TEXT NOT NULL,     -- organic_social | referral | email | qr …
  utm_campaign    TEXT NOT NULL,
  utm_content     TEXT NOT NULL,     -- 콘텐츠 레코드 기반 키
  target_url      TEXT NOT NULL,     -- 정상 상품/페이지 URL

  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, utm_campaign, utm_content, placement)
);
CREATE INDEX IF NOT EXISTS content_links_ws_idx ON content_links(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS content_links_item_idx ON content_links(content_item_id);

ALTER TABLE content_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS content_links_select ON content_links;
CREATE POLICY content_links_select ON content_links FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS content_links_write ON content_links;
CREATE POLICY content_links_write ON content_links FOR ALL
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE content_links IS
  'UTM 링크 등록부(10_WEB_ANALYTICS_PLAN §4). utm_content 는 콘텐츠 레코드 기반 키. 고객정보·임의 문장 금지. 재배포는 placement 로 구별.';
