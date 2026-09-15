-- ────────────────────────────────────────────────────────
-- 056: insights → company_memory 복사 (인사이트+기억 통합)
-- ────────────────────────────────────────────────────────
-- 배경: 통합 후 앱은 company_memory만 읽는다(docs/CONTENT_HUB_REDESIGN.md §3).
-- 워크스페이스 스코프(오피스) 인사이트를 company_memory(kind='insight')로 복사한다.
-- - 개인 인사이트(workspace_id IS NULL)는 company_memory가 워크스페이스 전용이라 제외 → 개인은 insights 테이블 유지.
-- - insights 테이블은 드롭하지 않고 보존(롤백 안전). 재실행 안전(이미 복사된 건 스킵).
-- priority→salience(high80/med50/low20), starred→pinned, source/link/category/tags 보존.

do $$
begin
  if to_regclass('public.insights') is null or to_regclass('public.company_memory') is null then
    raise notice 'insights 또는 company_memory 테이블이 없어 스킵';
    return;
  end if;

  insert into public.company_memory
    (id, workspace_id, created_by, kind, title, body, tags, salience, pinned, status, source, link, category, created_at, updated_at)
  select
    i.id, i.workspace_id, i.user_id, 'insight', i.title, i.content, i.tags,
    case i.priority when 'high' then 80 when 'medium' then 50 when 'low' then 20 else 50 end,
    coalesce(i.starred, false), 'active', i.source, i.link, i.category,
    coalesce(i.created_at, now()), now()
  from public.insights i
  where i.workspace_id is not null
    and not exists (select 1 from public.company_memory m where m.id = i.id);
end $$;
