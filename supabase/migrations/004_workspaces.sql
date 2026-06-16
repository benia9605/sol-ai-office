-- ────────────────────────────────────────────────────────
-- 공유 워크스페이스 — 빌드 A (기반, 무중단)
-- 확정설계: docs/guides/ai오피스구축/_공유워크스페이스_확정설계.md
-- 적용일: 2026-06-12
--
-- ⚠️ 대시보드 SQL 에디터에서 "위→아래 순서대로" 검토 후 적용.
--    모든 단계가 가산적(additive)이라 기존 동작 100% 보존
--    (기존 user_id 정책은 유지 + 새 정책을 OR로 얹음).
--    7번(NOT NULL)은 6번 백필 행 수 확인 후 실행 권장.
-- ────────────────────────────────────────────────────────

-- ── 1. 워크스페이스 / 멤버 / 활동 테이블 ──
CREATE TABLE IF NOT EXISTS workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  emoji       TEXT,
  color       TEXT,
  image_url   TEXT,                 -- 프로필 이미지 (URL 또는 base64)
  biz_info    TEXT,                 -- 사업 정보(어디서 하는 사업인지 · office용)
  type        TEXT NOT NULL DEFAULT 'office' CHECK (type IN ('personal','office')),
  invite_code TEXT UNIQUE,
  created_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 이미 테이블이 있던 경우 대비 (가산적)
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS biz_info  TEXT;

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  nickname     TEXT,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

-- 이메일 초대 (pending) — 가입 전 이메일로 초대해 두는 용도
CREATE TABLE IF NOT EXISTS workspace_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  invited_by   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)
);

CREATE TABLE IF NOT EXISTS workspace_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,   -- 'shared_task'|'recommended_task'|'shared_insight'|'ai_report_ready' 등
  resource_type TEXT,
  resource_id   UUID,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_members_user_idx   ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS workspace_invites_email_idx  ON workspace_invites(lower(email));
CREATE INDEX IF NOT EXISTS workspace_activities_ws_idx  ON workspace_activities(workspace_id, created_at DESC);

-- ── 2. RLS 헬퍼 함수 ──
-- 내가 속한 워크스페이스 id 집합 (STABLE: 쿼리당 1회 평가)
CREATE OR REPLACE FUNCTION my_workspace_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION is_workspace_member(ws_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION is_workspace_admin(ws_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid() AND role = 'owner'
  )
$$;

-- ── 3. 워크스페이스 테이블 RLS ──
ALTER TABLE workspaces          ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invites   ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspaces_select ON workspaces;
CREATE POLICY workspaces_select ON workspaces FOR SELECT
  USING (id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS workspaces_insert ON workspaces;
CREATE POLICY workspaces_insert ON workspaces FOR INSERT
  WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS workspaces_update ON workspaces;
CREATE POLICY workspaces_update ON workspaces FOR UPDATE
  USING (is_workspace_admin(id));
DROP POLICY IF EXISTS workspaces_delete ON workspaces;
CREATE POLICY workspaces_delete ON workspaces FOR DELETE
  USING (is_workspace_admin(id) AND type = 'team');

DROP POLICY IF EXISTS wm_select ON workspace_members;
CREATE POLICY wm_select ON workspace_members FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS wm_insert ON workspace_members;
CREATE POLICY wm_insert ON workspace_members FOR INSERT
  WITH CHECK (user_id = auth.uid() OR is_workspace_admin(workspace_id));
DROP POLICY IF EXISTS wm_delete ON workspace_members;
CREATE POLICY wm_delete ON workspace_members FOR DELETE
  USING (user_id = auth.uid() OR is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS wi_select ON workspace_invites;
CREATE POLICY wi_select ON workspace_invites FOR SELECT
  USING (is_workspace_member(workspace_id)
         OR lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())));
DROP POLICY IF EXISTS wi_write ON workspace_invites;
CREATE POLICY wi_write ON workspace_invites FOR ALL
  USING (is_workspace_admin(workspace_id))
  WITH CHECK (is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS wa_select ON workspace_activities;
CREATE POLICY wa_select ON workspace_activities FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS wa_insert ON workspace_activities;
CREATE POLICY wa_insert ON workspace_activities FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

-- ── 4. 가입 시 개인 워크스페이스 자동 생성 (트리거) ──
CREATE OR REPLACE FUNCTION ensure_personal_workspace(uid UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws_id UUID;
BEGIN
  SELECT id INTO ws_id FROM workspaces WHERE created_by = uid AND type = 'personal' LIMIT 1;
  IF ws_id IS NULL THEN
    INSERT INTO workspaces (name, emoji, type, created_by)
      VALUES ('내 오피스', '👤', 'personal', uid)
      RETURNING id INTO ws_id;
    INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES (ws_id, uid, 'owner') ON CONFLICT DO NOTHING;
  END IF;
  RETURN ws_id;
END $$;

CREATE OR REPLACE FUNCTION on_auth_user_created_ws()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM ensure_personal_workspace(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auth_user_created_ws ON auth.users;
CREATE TRIGGER trg_auth_user_created_ws
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION on_auth_user_created_ws();

-- 기존 유저 전원 개인 워크스페이스 백필
INSERT INTO workspaces (name, emoji, type, created_by)
SELECT '내 오피스', '👤', 'personal', u.id
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM workspaces w WHERE w.created_by = u.id AND w.type = 'personal'
);
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT w.id, w.created_by, 'owner'
FROM workspaces w WHERE w.type = 'personal'
ON CONFLICT DO NOTHING;

-- ── 5~8. 콘텐츠 테이블: "존재하는 테이블만" 컬럼 추가 + 백필 + 인덱스 + 공유 정책 ──
-- ⚠️ 일부 테이블이 없는 환경 대비 → to_regclass로 존재 확인 후 처리.
--    (스터디/독서 노트의 실제 테이블명은 reading_logs)
DO $$
DECLARE
  t TEXT;
  tbls TEXT[] := ARRAY['projects','tasks','schedules','insights','readings','reading_logs','journals'];
  sdef TEXT;
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE '건너뜀(테이블 없음): %', t;
      CONTINUE;
    END IF;

    -- workspace_id (공통)
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id)', t);

    -- is_shared (projects 제외 · journals만 기본 비공개)
    IF t <> 'projects' THEN
      sdef := CASE WHEN t = 'journals' THEN 'FALSE' ELSE 'TRUE' END;
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT %s', t, sdef);
    END IF;

    -- 타입별 추가 컬럼
    IF t = 'tasks' THEN
      EXECUTE 'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES auth.users(id)';
    ELSIF t = 'readings' THEN
      EXECUTE 'ALTER TABLE readings ADD COLUMN IF NOT EXISTS recommended_by UUID REFERENCES auth.users(id)';
    END IF;

    -- 백필: 기존 행 → 작성자의 개인 워크스페이스
    EXECUTE format($f$
      UPDATE %I AS c SET workspace_id = (
        SELECT w.id FROM workspaces w WHERE w.created_by = c.user_id AND w.type = 'personal' LIMIT 1
      ) WHERE c.workspace_id IS NULL
    $f$, t);

    -- 인덱스
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(workspace_id)', t || '_ws_idx', t);

    -- 가산적 공유 정책 (기존 user_id 정책 유지 · OR 합산)
    IF t = 'tasks' THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS tasks_assignee_idx ON tasks(assignee_id)';
      EXECUTE 'DROP POLICY IF EXISTS tasks_select_ws ON tasks';
      EXECUTE 'CREATE POLICY tasks_select_ws ON tasks FOR SELECT USING (assignee_id = auth.uid() OR (is_shared AND workspace_id IN (SELECT my_workspace_ids())))';
      EXECUTE 'DROP POLICY IF EXISTS tasks_update_ws ON tasks';
      EXECUTE 'CREATE POLICY tasks_update_ws ON tasks FOR UPDATE USING (assignee_id = auth.uid() OR (is_shared AND workspace_id IN (SELECT my_workspace_ids())))';
    ELSIF t <> 'projects' THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select_ws', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (is_shared AND workspace_id IN (SELECT my_workspace_ids()))', t || '_select_ws', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_update_ws', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (is_shared AND workspace_id IN (SELECT my_workspace_ids()))', t || '_update_ws', t);
    END IF;
  END LOOP;
END $$;

-- (선택) 백필 검증 후 NOT NULL: SELECT count(*) FROM tasks WHERE workspace_id IS NULL; → 0 확인 뒤
--   ALTER TABLE tasks ALTER COLUMN workspace_id SET NOT NULL;  (테이블별로)

COMMENT ON TABLE workspaces IS '워크스페이스(사람 묶음): personal=개인, office=회사';
