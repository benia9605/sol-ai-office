-- ────────────────────────────────────────────────────────
-- 051: options 테이블 워크스페이스 지원 (공통 카테고리 시스템)
-- ────────────────────────────────────────────────────────
-- 배경: 카테고리를 개인+오피스 전 메뉴에서 동일 방식으로 관리하려 한다(docs/CATEGORY_SYSTEM.md).
-- options 테이블(category='<scope>_category', name, color, sort_order)이 이미 색상까지 있어 이걸 공통 기반으로 쓴다.
-- 지금은 user_id 전용(개인)이라 오피스(workspace) 세트를 담지 못한다.
-- 이 마이그레이션: workspace_id(nullable) 추가 → NULL=개인, 값=오피스. 기존 행은 개인(NULL) 유지.
-- (options는 base 테이블이라 DDL이 레포에 없음 → 존재 가드)

do $$
begin
  if to_regclass('public.options') is null then
    raise notice 'options 테이블이 없어 스킵(환경에 따라 base 테이블 미존재 가능)';
    return;
  end if;

  alter table public.options add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
  create index if not exists options_ws_cat_idx on public.options(workspace_id, category, sort_order);
  create index if not exists options_user_cat_idx on public.options(user_id, category, sort_order);
end $$;

-- RLS: 개인(user_id 본인) 또는 오피스(workspace 멤버) 접근 허용.
-- 기존 정책이 user_id만 볼 수 있게 되어 있으면 workspace 멤버 조건을 추가한다.
do $$
begin
  if to_regclass('public.options') is null then return; end if;

  drop policy if exists options_rw ON public.options;
  create policy options_rw ON public.options
    for all
    using (
      user_id = auth.uid()
      or (workspace_id is not null and exists (
        select 1 from public.workspace_members m
        where m.workspace_id = options.workspace_id and m.user_id = auth.uid()
      ))
    )
    with check (
      user_id = auth.uid()
      or (workspace_id is not null and exists (
        select 1 from public.workspace_members m
        where m.workspace_id = options.workspace_id and m.user_id = auth.uid()
      ))
    );
end $$;
