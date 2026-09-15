-- ────────────────────────────────────────────────────────
-- 054: youtube_videos → content_items 연결 (콘텐츠 허브 유튜브 통합)
-- ────────────────────────────────────────────────────────
-- 배경: 콘텐츠 허브가 마스터, 유튜브(라이브 성과·댓글)는 발행 채널 실측 데이터로 붙인다(docs/CONTENT_HUB_REDESIGN.md).
-- youtube_videos에 content_item_id FK를 추가해, 콘텐츠 발행물(channel=youtube)에 실제 유튜브 영상을 연결한다.
-- 연결되면 조회/좋아요/댓글을 그 콘텐츠 수치로 자동 반영(후속 단계). nullable + 무중단.
-- (youtube_videos는 003에서 생성. 존재 가드.)

do $$
begin
  if to_regclass('public.youtube_videos') is null then
    raise notice 'youtube_videos 테이블이 없어 스킵';
    return;
  end if;
  alter table public.youtube_videos add column if not exists content_item_id uuid references public.content_items(id) on delete set null;
  create index if not exists youtube_videos_content_idx on public.youtube_videos(content_item_id);
end $$;

comment on column public.youtube_videos.content_item_id is '연결된 콘텐츠 발행물(content_items). 연결 시 조회/좋아요/댓글이 그 콘텐츠 수치로 반영. 마이그 054';
