-- ────────────────────────────────────────────────────────
-- 063: 로컬 bridge 왕복 + 대표 수정 요청 + 업무 MD (BRIDGE-O1 · OPS-O1/O3/O4)
-- ────────────────────────────────────────────────────────
-- 배경(공유 폴더):
--   · 15_LOCAL_DATA_BRIDGE.md — Office Supabase ↔ 로컬 업무 사본 ↔ GPT 왕복을 MVP 필수로.
--     "Office 에 저장된 자료를 기준으로 로컬 사본을 만든다. 그래야 Office 에서 쓴
--      수정 요청·결정·사진 지시도 빠지지 않는다."
--   · GPT_OPERATIONS_round1 OPS-O1/O3/O4.
--
-- 이 마이그레이션이 만드는 것
--   ① edit_requests  — 대표가 Office 에 남기는 수정 요청(이유·기준 버전·상태·실제 읽은 시각)
--   ② work_documents — 업무 MD 원문 보관(중복 방지·정정 구별)
--   ③ bridge_runs    — pull/push 실행 원장(멱등 키·receipt·실제 읽은 시각)
--   ④ bridge_outputs — GPT 가 push 한 결과물의 저장 결과(run 당 멱등)
--
-- 전부 가산적·idempotent. 적용: Supabase 대시보드 SQL 에디터.
-- ⚠️ D-007: 이 경로 어디에도 모델 API 호출이 없다. 일반 데이터 저장·조회다.
-- ────────────────────────────────────────────────────────

-- ── ① 대표 수정 요청 (OPS-O1) ──
-- "기준 버전이 바뀐 대표 원고를 덮어쓰지 않는다. 충돌은 별도 표시한다"(15 §BRIDGE-O1.5)
CREATE TABLE IF NOT EXISTS edit_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- 무엇에 대한 요청인가 (polymorphic — 콘텐츠·보고서 등)
  target_type   TEXT NOT NULL CHECK (target_type IN ('content_item','daily_report','work_document','asset')),
  target_id     TEXT NOT NULL,
  /** 요청이 기준으로 삼은 버전. 이 값이 현재와 다르면 충돌이다. */
  base_version  TEXT,

  title         TEXT NOT NULL,
  body          TEXT NOT NULL,          -- 무엇을 어떻게 바꿔달라는지
  reason        TEXT,                   -- 왜 (GPT 가 판단 근거로 읽는다)
  /** 대표가 직접 고친 부분이 있으면 그 diff 를 그대로 보관한다 */
  direct_edit_diff TEXT,

  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','read','answered','applied','conflicted','dismissed')),
  /** ★ GPT 가 **실제로 읽은** 시각. 저장만 한 것과 구별한다(15 §BRIDGE-O1.6) */
  read_at       TIMESTAMPTZ,
  read_by_run   TEXT,                   -- 어느 bridge run 이 읽었나
  answered_at   TIMESTAMPTZ,
  answered_ref  TEXT,                   -- 결과물 참조(보고서/콘텐츠 버전 id)
  conflict_note TEXT,                   -- 기준 버전이 바뀌었을 때 설명

  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS edit_requests_ws_idx ON edit_requests(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS edit_requests_open_idx ON edit_requests(workspace_id, status) WHERE status IN ('open','read');
CREATE INDEX IF NOT EXISTS edit_requests_target_idx ON edit_requests(target_type, target_id);

ALTER TABLE edit_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS edit_requests_select ON edit_requests;
CREATE POLICY edit_requests_select ON edit_requests FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS edit_requests_insert ON edit_requests;
CREATE POLICY edit_requests_insert ON edit_requests FOR INSERT
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS edit_requests_update ON edit_requests;
CREATE POLICY edit_requests_update ON edit_requests FOR UPDATE
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE edit_requests IS
  '대표가 Office 에 남기는 수정 요청(OPS-O1). 이유·기준 버전·직접 편집 diff·상태·GPT 가 실제 읽은 시각. bridge 가 로컬 MD 로 내보낸다.';

-- ── ② 업무 MD 원문 보관 (OPS-O3) ──
-- "동일 파일 중복·정정·미확정 제안 구별"
CREATE TABLE IF NOT EXISTS work_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  title         TEXT NOT NULL,
  body_md       TEXT NOT NULL,          -- 원문 그대로 (요약으로 대체하지 않는다)
  body_sha256   TEXT NOT NULL,          -- 같은 파일 재업로드 판별
  kind          TEXT NOT NULL DEFAULT 'note'
                CHECK (kind IN ('note','plan','brief','decision','proposal','handover')),
  /** 미확정 제안인지 확정된 기록인지 구별 */
  is_proposal   BOOLEAN NOT NULL DEFAULT FALSE,
  /** 정정이면 어떤 문서를 대체하는가 */
  supersedes_id UUID REFERENCES work_documents(id) ON DELETE SET NULL,
  source_name   TEXT,                   -- 원본 파일명(있으면)
  tags          TEXT[],

  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ★ 같은 workspace 에 같은 내용을 두 번 넣지 않는다 (중복 방지)
  UNIQUE (workspace_id, body_sha256)
);
CREATE INDEX IF NOT EXISTS work_documents_ws_idx ON work_documents(workspace_id, created_at DESC);

ALTER TABLE work_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS work_documents_select ON work_documents;
CREATE POLICY work_documents_select ON work_documents FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS work_documents_insert ON work_documents;
CREATE POLICY work_documents_insert ON work_documents FOR INSERT
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
-- 원문은 고치지 않는다. 정정은 새 행 + supersedes_id.

COMMENT ON TABLE work_documents IS
  '업무 MD 원문 보관(OPS-O3). body_sha256 UNIQUE 로 같은 파일 중복 저장 방지. 정정은 새 행 + supersedes_id. 원문은 수정하지 않는다.';

-- ── ③ bridge 실행 원장 (BRIDGE-O1) ──
-- pull/push 를 각각 기록한다. "저장만 했는데 GPT 처리 완료로 표시하지 않는다"(15 §BRIDGE-O1.6)
CREATE TABLE IF NOT EXISTS bridge_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  run_id        TEXT NOT NULL,          -- 로컬이 만든 결정적 run 식별자
  direction     TEXT NOT NULL CHECK (direction IN ('pull','push')),
  status        TEXT NOT NULL DEFAULT 'started'
                CHECK (status IN ('started','succeeded','failed','conflicted')),

  snapshot_id   TEXT,                   -- pull 이 고정한 로컬 snapshot id
  /** pull: 로컬로 내려간 시각 / push: Office 가 결과를 받은 시각 */
  completed_at  TIMESTAMPTZ,
  manifest_sha256 TEXT,
  counts        JSONB,                  -- {edit_requests: n, reports: n, ...}
  error         TEXT,
  trace_id      TEXT,

  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 같은 run 을 두 번 기록하지 않는다 (멱등)
  UNIQUE (workspace_id, run_id, direction)
);
CREATE INDEX IF NOT EXISTS bridge_runs_ws_idx ON bridge_runs(workspace_id, created_at DESC);

ALTER TABLE bridge_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bridge_runs_select ON bridge_runs;
CREATE POLICY bridge_runs_select ON bridge_runs FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS bridge_runs_insert ON bridge_runs;
CREATE POLICY bridge_runs_insert ON bridge_runs FOR INSERT
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS bridge_runs_update ON bridge_runs;
CREATE POLICY bridge_runs_update ON bridge_runs FOR UPDATE
  USING (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE bridge_runs IS
  'bridge pull/push 실행 원장(BRIDGE-O1). (workspace, run_id, direction) UNIQUE 로 같은 run 재시도가 중복을 만들지 않는다.';

-- ── ④ push 결과물 (BRIDGE-O1.4) ──
-- "GPT outbox 를 Office 에 멱등 저장하고 서버 재조회로 ID/version/hash 를 확인해 receipt 를 남긴다"
CREATE TABLE IF NOT EXISTS bridge_outputs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id         TEXT NOT NULL,
  /** outbox 안에서의 항목 키 — 같은 run 의 같은 항목을 두 번 저장하지 않는다 */
  item_key       TEXT NOT NULL,

  kind           TEXT NOT NULL CHECK (kind IN ('report_draft','content_draft','answer','work_document')),
  /** 실제로 저장된 레코드 */
  stored_table   TEXT,
  stored_id      TEXT,
  stored_version TEXT,
  body_sha256    TEXT NOT NULL,          -- 수신 원문 해시
  raw_body_text  TEXT,                   -- 원문 보관(파싱본으로 대체하지 않는다)
  /** 어떤 수정 요청에 대한 답인가 */
  answers_request_id UUID REFERENCES edit_requests(id) ON DELETE SET NULL,
  input_refs     JSONB,                  -- GPT 가 읽었다고 밝힌 근거(snapshot_id 등)
  status         TEXT NOT NULL DEFAULT 'stored'
                 CHECK (status IN ('stored','duplicate','conflicted','rejected')),
  note           TEXT,

  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (workspace_id, run_id, item_key)
);
CREATE INDEX IF NOT EXISTS bridge_outputs_ws_idx ON bridge_outputs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bridge_outputs_req_idx ON bridge_outputs(answers_request_id);

ALTER TABLE bridge_outputs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bridge_outputs_select ON bridge_outputs;
CREATE POLICY bridge_outputs_select ON bridge_outputs FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS bridge_outputs_insert ON bridge_outputs;
CREATE POLICY bridge_outputs_insert ON bridge_outputs FOR INSERT
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE bridge_outputs IS
  'GPT outbox 를 Office 에 저장한 결과(BRIDGE-O1.4). (workspace, run_id, item_key) UNIQUE = 멱등. 원문 raw_body_text + body_sha256 보관.';
