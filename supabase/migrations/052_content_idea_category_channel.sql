-- ────────────────────────────────────────────────────────
-- 052: content_items — 아이디어 트리 + 카테고리 + 채널 정규화 (콘텐츠 허브)
-- ────────────────────────────────────────────────────────
-- 배경: 콘텐츠 메뉴를 "아이디어 1개 → 채널별 발행물 N개 + 각 수치" 허브로 개편(docs/CONTENT_HUB_REDESIGN.md).
-- - idea_id: 자기참조. NULL=루트(아이디어 자체), 값=그 아이디어에 속한 발행물. (1단계 트리)
-- - category: 공용 카테고리 시스템(options, scope='content') id. 기존 content_type(4종)과는 별개.
-- - channel: 정규화 채널 키(youtube|instagram|threads|daangn|blog|tiktok|etc). platform(자유문자열)에서 백필.
-- 모두 nullable + 무중단.

alter table public.content_items add column if not exists idea_id  uuid references public.content_items(id) on delete set null;
alter table public.content_items add column if not exists category text;
alter table public.content_items add column if not exists channel  text;

create index if not exists content_items_idea_idx    on public.content_items(idea_id);
create index if not exists content_items_channel_idx on public.content_items(workspace_id, channel);

-- platform(자유문자열) → channel(정규화) 백필. channel이 아직 비어있는 행만.
update public.content_items set channel = case
  when platform ilike '%youtube%'    then 'youtube'
  when platform ilike '%shorts%'     then 'youtube'
  when platform ilike '%instagram%'  then 'instagram'
  when platform ilike '%reels%'      then 'instagram'
  when platform ilike '%thread%'     then 'threads'
  when platform ilike '%당근%'        then 'daangn'
  when platform ilike '%daangn%'     then 'daangn'
  when platform ilike '%karrot%'     then 'daangn'
  when platform ilike '%blog%'       then 'blog'
  when platform ilike '%tiktok%'     then 'tiktok'
  when platform is not null and platform <> '' then 'etc'
  else null
end
where channel is null;

comment on column public.content_items.idea_id  is '부모 아이디어(자기참조). NULL=아이디어 루트, 값=발행물. docs/CONTENT_HUB_REDESIGN.md';
comment on column public.content_items.category is '공용 카테고리(options scope=content) id.';
comment on column public.content_items.channel  is '정규화 채널 키: youtube|instagram|threads|daangn|blog|tiktok|etc.';
