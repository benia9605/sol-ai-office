-- ────────────────────────────────────────────────────────
-- 초대 코드로 합류 — RLS 우회 가입 함수
-- 문제: workspaces_select 정책이 "멤버만 조회 가능"이라,
--       아직 멤버가 아닌 초대받은 사람은 코드로 워크스페이스를 못 찾음.
-- 해결: SECURITY DEFINER 함수로 코드 조회 + 본인 멤버 등록을 한 번에 처리.
-- 적용일: 2026-06-17
-- ⚠️ 대시보드 SQL 에디터에서 실행.
-- ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION join_office_by_code(p_code TEXT)
RETURNS workspaces
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws workspaces;
BEGIN
  SELECT * INTO ws
  FROM workspaces
  WHERE invite_code = upper(trim(p_code)) AND type = 'office'
  LIMIT 1;

  IF ws.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_CODE' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (ws.id, auth.uid(), 'member')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  RETURN ws;
END $$;

GRANT EXECUTE ON FUNCTION join_office_by_code(TEXT) TO authenticated;
