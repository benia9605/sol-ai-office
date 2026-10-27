-- ────────────────────────────────────────────────────────
-- 072: 회의록 - 회의 HTML · 회의에서 나온 할 일(약속 날짜 / 추천 날짜) - 2026-10-27 대표 실행
-- ────────────────────────────────────────────────────────
-- 배경 (2026-10-27 대표 결정):
--   · 시목은 매주 화요일 회의. 클로바노트 텍스트를 본부에 주면 본부가 회의 HTML 을 만들고
--     오피스 「회의」 메뉴에 넣고, 우리 할 일은 바로 할 일로 넣는다 (아버님 할 일은 HTML 에만)
--   · 날짜 두 종류
--       promised  회의에서 「언제까지」 정한 것 - 그 날짜 · 하루 전 · 당일 알림 · 못 하면 「밀림」
--       planned   「해 보자」 만 한 것 - 다음 회의 전까지 본부가 나눠 넣은 추천 날짜 · 당일 알림만 · 못 하면 「아직」
--
-- 이 마이그레이션은
--   ① hq_meetings - 회의 (날짜 · 제목 · 요약 · HTML · 참석 등 meta)
--   ② hq_tasks.meeting_id · hq_tasks.due_kind
--   ③ hq_meeting(토큰, 꾸러미) - 본부가 회의 하나와 그 할 일을 넣는다. 다시 보내면 회의는 고치고,
--      이미 있는 할 일은 설명만 고친다 (사람이 바꾼 날짜 · 담당 · 상태는 그대로)
--      담당은 멤버 이름(닉네임)으로 받는다 · 「공동」 이면 공동 · 못 찾으면 담당 없음
--   ④ hq_pull 에 최근 회의 둘과 그 할 일 진행 상황 (화요일 아침 보고서가 읽는다)
-- 가산적 · 여러 번 돌려도 안전.

-- ── ① 회의 ──
create table if not exists hq_meetings (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  date         date not null,
  title        text not null,
  summary      text,
  html         text,
  meta         jsonb not null default '{}',   -- {attendees, decisions, hau_tasks, next_check ...}
  hq_key       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists hq_meetings_key_uidx on hq_meetings(workspace_id, hq_key) where hq_key is not null;
create index if not exists hq_meetings_ws_idx on hq_meetings(workspace_id, date desc);

alter table hq_meetings enable row level security;
drop policy if exists hq_meetings_select on hq_meetings;
create policy hq_meetings_select on hq_meetings for select using (workspace_id in (select my_workspace_ids()));
drop policy if exists hq_meetings_update on hq_meetings;
create policy hq_meetings_update on hq_meetings for update using (workspace_id in (select my_workspace_ids())) with check (workspace_id in (select my_workspace_ids()));
drop policy if exists hq_meetings_delete on hq_meetings;
create policy hq_meetings_delete on hq_meetings for delete using (workspace_id in (select my_workspace_ids()));

-- ── ② 할 일 칸 ──
alter table hq_tasks add column if not exists meeting_id uuid references hq_meetings(id) on delete set null;
alter table hq_tasks add column if not exists due_kind text check (due_kind in ('promised', 'planned'));
create index if not exists hq_tasks_meeting_idx on hq_tasks(meeting_id) where meeting_id is not null;
comment on column hq_tasks.due_kind is 'promised = 회의에서 정한 날짜 · planned = 본부 추천 날짜 (072)';

-- ── ③ hq_meeting ──
create or replace function hq_meeting(p_token text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  ws   uuid := hq_auth(p_token);
  mid  uuid;
  x    jsonb;
  who  text;
  uid  uuid;
  ins  boolean;
  n    int := 0;
  nn   int := 0;
  lbl  text;
  assigned jsonb := '{}';
begin
  if coalesce(p_payload->>'date', '') = '' or coalesce(p_payload->>'title', '') = '' then
    raise exception 'hq_meeting: date · title 필요' using errcode = '22023';
  end if;
  insert into hq_meetings (workspace_id, date, title, summary, html, meta, hq_key)
  values (ws, (p_payload->>'date')::date, p_payload->>'title', p_payload->>'summary', p_payload->>'html',
          coalesce(p_payload->'meta', '{}'), p_payload->>'key')
  on conflict (workspace_id, hq_key) where hq_key is not null
  do update set date = excluded.date, title = excluded.title, summary = excluded.summary, html = excluded.html,
                meta = excluded.meta, updated_at = now()
  returning id into mid;

  lbl := '회의 ' || to_char((p_payload->>'date')::date, 'MM.DD');
  for x in select * from jsonb_array_elements(coalesce(p_payload->'tasks', '[]')) loop
    who := trim(coalesce(x->>'assignee', ''));
    uid := null;
    if who <> '' and who <> '공동' then
      select m.user_id into uid from workspace_members m
       where m.workspace_id = ws and hq_member_name(ws, m.user_id) = who limit 1;
    end if;
    insert into hq_tasks (workspace_id, title, why, source, source_label, status, due_date, due_kind,
                          assignee_user_id, assignee_shared, meeting_id, hq_key, history)
    values (ws, x->>'title', x->>'why', 'hq',
            lbl || case x->>'due_kind' when 'promised' then ' · 약속 날짜' when 'planned' then ' · 추천 날짜' else '' end,
            'open', nullif(x->>'due_date', '')::date,
            case when x->>'due_kind' in ('promised', 'planned') then x->>'due_kind' end,
            uid, who = '공동', mid, x->>'key',
            jsonb_build_array(jsonb_build_object('at', now(), 'text', lbl || ' 에서 생김', 'by', '본부')))
    on conflict (workspace_id, hq_key) where hq_key is not null
    do update set why = excluded.why, meeting_id = excluded.meeting_id, updated_at = now()
    returning (xmax = 0) into ins;
    n := n + 1;
    if ins then
      nn := nn + 1;
      if uid is not null then
        assigned := jsonb_set(assigned, array[uid::text], to_jsonb(coalesce((assigned->>uid::text)::int, 0) + 1));
      end if;
    end if;
  end loop;

  return jsonb_build_object('meeting_id', mid, 'workspace_id', ws, 'tasks', n, 'new_tasks', nn, 'assigned', assigned,
                            'actor_id', hq_actor(ws, p_token));
end $$;
revoke all on function hq_meeting(text, jsonb) from public;
grant execute on function hq_meeting(text, jsonb) to anon, authenticated;
comment on function hq_meeting(text, jsonb) is '본부(sol-hq) → 오피스: 회의 하나 + 그 회의 할 일 (072). 토큰 워크스페이스 안에서만';

-- ── ④ hq_pull 에 회의 · 회의 할 일 (068 + 회의) ──
create or replace function hq_pull(p_token text, p_since timestamptz default now() - interval '2 days')
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare ws uuid := hq_auth(p_token);
begin
  return jsonb_build_object(
    'workspace_id', ws,
    'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', coalesce(m.nickname, ''), 'role', m.role)), '[]')
                  from workspace_members m where m.workspace_id = ws),
    'tasks', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'key', t.hq_key, 'title', t.title, 'source', t.source, 'status', t.status,
                     'due_date', t.due_date, 'assignee_user_id', t.assignee_user_id, 'shared', t.assignee_shared, 'memo', t.memo, 'done_at', t.done_at,
                     'done_by', case when t.done_by is not null then hq_member_name(ws, t.done_by) end,
                     'due_kind', t.due_kind, 'meeting_id', t.meeting_id,
                     'updated_at', t.updated_at) order by t.updated_at desc), '[]')
                from hq_tasks t where t.workspace_id = ws and (t.status in ('open','proposed') or t.updated_at >= p_since)),
    'decisions', (select coalesce(jsonb_agg(jsonb_build_object('key', x.hq_key, 'question', x.question, 'status', x.status, 'picked', x.picked,
                     'opinion', x.opinion, 'make_task', x.make_task, 'decided_at', x.decided_at,
                     'decided_by', case when x.decided_by is not null then hq_member_name(ws, x.decided_by) end)), '[]')
                from hq_decisions x where x.workspace_id = ws and (x.status = 'open' or x.decided_at >= p_since or x.updated_at >= p_since)),
    -- 댓글: on = briefing(date · slot) · decision(question) · meeting(title) · task(title)
    'comments', (select coalesce(jsonb_agg(jsonb_build_object('on', y.kind, 'date', y.date, 'slot', y.slot, 'about', y.about,
                     'by', coalesce(hq_member_name(ws, y.user_id), '멤버'), 'text', y.content, 'at', y.created_at) order by y.created_at), '[]')
                from (
                  select 'briefing' kind, b.date, split_part(c.ref_id, ':', 2) slot, null::text about, c.user_id, c.content, c.created_at
                    from social_comments c join hq_briefings b on b.id::text = split_part(c.ref_id, ':', 1)
                   where c.workspace_id = ws and c.ref_type = 'hq_briefing' and c.created_at >= p_since
                  union all
                  select 'decision', x.date, null, x.question, c.user_id, c.content, c.created_at
                    from social_comments c join hq_decisions x on x.id::text = c.ref_id
                   where c.workspace_id = ws and c.ref_type = 'hq_decision' and c.created_at >= p_since
                  union all
                  select 'meeting', m.date, null, m.title, c.user_id, c.content, c.created_at
                    from social_comments c join hq_meetings m on m.id::text = c.ref_id
                   where c.workspace_id = ws and c.ref_type = 'hq_meeting' and c.created_at >= p_since
                  union all
                  select 'task', null, null, t.title, c.user_id, c.content, c.created_at
                    from social_comments c join hq_tasks t on t.id::text = c.ref_id
                   where c.workspace_id = ws and c.ref_type = 'hq_task' and c.created_at >= p_since) y),
    -- 최근 회의 둘과 그 회의 할 일 전부 (화요일 보고서가 진행 상황을 본다 · 지운 것 빼고)
    'meetings', (select coalesce(jsonb_agg(jsonb_build_object('id', mt.id, 'date', mt.date, 'title', mt.title, 'summary', mt.summary,
                     'tasks', (select coalesce(jsonb_agg(jsonb_build_object('title', t.title, 'status', t.status, 'due_date', t.due_date,
                                 'due_kind', t.due_kind, 'done_at', t.done_at,
                                 'done_by', case when t.done_by is not null then hq_member_name(ws, t.done_by) end,
                                 'assignee', case when t.assignee_shared then '공동' when t.assignee_user_id is not null then hq_member_name(ws, t.assignee_user_id) end)
                                 order by t.due_date nulls last), '[]')
                               from hq_tasks t where t.meeting_id = mt.id and t.status <> 'deleted')) order by mt.date desc), '[]')
                from (select * from hq_meetings where workspace_id = ws order by date desc limit 2) mt),
    -- 예전 칸 (067) - 이제 댓글로 쌓인다. 남은 것만
    'briefing_memos', (select coalesce(jsonb_agg(jsonb_build_object('date', b.date, 'memos', b.memos) order by b.date desc), '[]')
                from hq_briefings b where b.workspace_id = ws and b.source = 'hq' and b.memos <> '{}' and b.memos_updated_at >= p_since),
    'research_notes', (select coalesce(jsonb_agg(jsonb_build_object('kind', r.kind, 'title', r.title, 'summary', r.summary, 'link', r.link, 'date', r.date)), '[]')
                from hq_research r where r.workspace_id = ws and r.source = 'me' and r.created_at >= p_since),
    'contents', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'key', c.hq_key, 'title', c.title, 'channel', c.channel, 'stage', c.stage,
                     'due_date', c.due_date, 'draft', c.draft, 'draft_status', c.draft_status, 'memo', c.memo)), '[]')
                from hq_contents c where c.workspace_id = ws and c.stage <> 'done'),
    'prompts', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'category', pc.name, 'tool', p.tool, 'body', p.body, 'version', p.version)), '[]')
                from hq_prompts p left join hq_prompt_categories pc on pc.id = p.category_id where p.workspace_id = ws)
  );
end $$;
revoke all on function hq_pull(text, timestamptz) from public;
grant execute on function hq_pull(text, timestamptz) to anon, authenticated;
