-- ────────────────────────────────────────────────────────
-- 048: 보안 강화 (권한 상승 차단 · 첨부 삭제 · 인사이트/기록 수정 제한)
-- ────────────────────────────────────────────────────────
-- 감사에서 발견된 것들을 막는다.
--  C2) 일반 멤버가 자기 role을 owner로 바꿔 권한 상승 → role 변경은 관리자만.
--  M2) 멤버 누구나 남의 첨부 삭제 가능 → 업로더 또는 관리자만.
--  M1) 멤버 누구나 남의 공유 인사이트/기록 수정 가능 → 작성자 또는 관리자만.
-- idempotent.

-- ── C2. workspace_members role 변경은 관리자만 (트리거) ──
create or replace function prevent_member_role_escalation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- 본인 행이라도 role을 바꾸려면 워크스페이스 관리자여야 한다
  if new.role is distinct from old.role and not is_workspace_admin(old.workspace_id) then
    raise exception '역할 변경은 워크스페이스 관리자만 할 수 있습니다';
  end if;
  return new;
end $$;
drop trigger if exists trg_wm_role_guard on workspace_members;
create trigger trg_wm_role_guard before update on workspace_members
  for each row execute function prevent_member_role_escalation();

-- ── M2. 첨부 삭제는 업로더 또는 관리자만 (테이블 + storage) ──
drop policy if exists attachments_delete on attachments;
create policy attachments_delete on attachments for delete
  using (uploaded_by = auth.uid() or is_workspace_admin(workspace_id));

drop policy if exists attachments_obj_delete on storage.objects;
create policy attachments_obj_delete on storage.objects for delete
  using (bucket_id = 'attachments'
         and (owner = auth.uid()
              or is_workspace_admin(((storage.foldername(name))[1])::uuid)));

-- ── M1. 인사이트/기록 수정은 작성자 또는 관리자만 (004의 팀-수정 정책 대체) ──
do $$
begin
  if to_regclass('public.insights') is not null then
    drop policy if exists insights_update_ws on insights;
    create policy insights_update_ws on insights for update
      using (created_by = auth.uid() or is_workspace_admin(workspace_id));
  end if;
  if to_regclass('public.journals') is not null then
    drop policy if exists journals_update_ws on journals;
    create policy journals_update_ws on journals for update
      using (created_by = auth.uid() or is_workspace_admin(workspace_id));
  end if;
end $$;
