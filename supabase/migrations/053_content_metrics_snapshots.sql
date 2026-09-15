    -- ────────────────────────────────────────────────────────
    -- 053: content_metrics — 기록시점 스냅샷 + 채널별 지표(JSON) (콘텐츠 허브)
    -- ────────────────────────────────────────────────────────
    -- 배경: 콘텐츠 수치를 24h/72h/7d 고정 체크포인트가 아니라, "기록한 시점(measured_at) 스냅샷"으로 쌓는다.
    -- 채널마다 제공 지표가 달라(인스타 도달/저장/프로필방문, 스레드 리포스트/인용, 당근 채팅…) 지표는 JSON으로 저장.
    -- - metrics(jsonb): 채널별 실측 지표 {views, likes, comments, ...}
    -- - checkpoint: 유니크/필수 해제 → 같은 콘텐츠에 시점별 여러 스냅샷 허용(레거시 값은 그대로 둠)
    -- 무중단(add column / drop constraint if exists).

    alter table public.content_metrics add column if not exists metrics jsonb;

    -- 시점별 다중 스냅샷 허용: (content_item_id, checkpoint) 유니크 + checkpoint 필수/CHECK 해제
    alter table public.content_metrics drop constraint if exists content_metrics_content_item_id_checkpoint_key;
    alter table public.content_metrics alter column checkpoint drop not null;
    alter table public.content_metrics drop constraint if exists content_metrics_checkpoint_check;

    create index if not exists content_metrics_item_time_idx on public.content_metrics(content_item_id, measured_at desc);

    comment on column public.content_metrics.metrics is '채널별 실측 지표 JSON(예: instagram {views,reach,likes,comments,shares,saves,profile,follows}). 시점=measured_at. docs/CONTENT_HUB_REDESIGN.md';
    comment on column public.content_metrics.checkpoint is '레거시(h24/h72/d7). 새 스냅샷은 NULL — 시점은 measured_at 사용.';
