-- ────────────────────────────────────────────────────────
-- 067: 브리핑 메모 + 본부 보고서에서 바로 체크 · 결정 · 의견 · 메모
-- ────────────────────────────────────────────────────────
-- 배경 (2026-10-27 대표 요청):
--   · Cursor 로 보는 본부 보고서에서 할 일 체크 · 결정 안 누르기 · 메모 저장을 하면 오피스에 바로 맞춰진다
--   · 메모는 그날 브리핑 안에 저장한다 (오피스 브리핑 · 본부 보고서가 같은 메모를 본다)
--   · 결정 메모는 결정의 「의견」 (결정 메뉴와 같은 칸)
--
-- 이 마이그레이션은
--   ① hq_briefings.memos - 브리핑 메모 칸 {칸 id: 글}. 본부가 브리핑을 다시 보내도 지워지지 않는다
--   ② hq_act - 본부 토큰으로 부르는 좁은 함수. 할 수 있는 것은 다섯 가지뿐
--        state   브리핑에 나온 할 일 · 결정 · 메모의 지금 상태 읽기
--        task    할 일 완료 · 완료 취소 (제목이 같은 것 · 지우기 · 새로 만들기 없음)
--        decide  결정 고르기 · 취소 (그 결정의 안 중에서만)
--        opinion 결정 의견 쓰기
--        memo    그날 브리핑 메모 칸 쓰기 (칸 id 는 top · free · brand 만)
--   ③ hq_pull 에 브리핑 메모 추가 (다음 날 본부가 읽는다)
-- 모두 토큰의 워크스페이스 안에서만. 가산적 · 여러 번 돌려도 안전.

-- ── ① 브리핑 메모 ──
alter table hq_briefings add column if not exists memos jsonb not null default '{}';
alter table hq_briefings add column if not exists memos_updated_at timestamptz;
comment on column hq_briefings.memos is '브리핑 메모 {top: 오늘 꼭 할 일 메모, brand: 브랜드 칸 메모, free: 오늘 메모}. 오피스 브리핑 · 본부 보고서가 같이 쓴다';

-- ── ② hq_act ──
create or replace function hq_act(p_token text, p_act jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  ws  uuid := hq_auth(p_token);
  op  text := p_act->>'op';
  d   date := nullif(p_act->>'date', '')::date;
  txt text;
  tid uuid;
  did uuid;
  opts jsonb;
begin
  if op = 'state' then
    return jsonb_build_object(
      'tasks', (select coalesce(jsonb_object_agg(t.title, t.status = 'done'), '{}') from (
                  select distinct on (title) title, status from hq_tasks
                   where workspace_id = ws and status <> 'deleted'
                     and title in (select jsonb_array_elements_text(coalesce(p_act->'titles', '[]')))
                   order by title, updated_at desc) t),
      'decisions', (select coalesce(jsonb_object_agg(x.question, jsonb_build_object(
                       'picked', case when x.status = 'decided' then coalesce(x.picked, '') end, 'opinion', x.opinion)), '{}') from (
                  select distinct on (question) question, status, picked, opinion from hq_decisions
                   where workspace_id = ws
                     and question in (select jsonb_array_elements_text(coalesce(p_act->'questions', '[]')))
                   order by question, updated_at desc) x),
      'memos', coalesce((select memos from hq_briefings where workspace_id = ws and date = d and source = 'hq'), '{}'));
  end if;

  if op = 'task' then
    select id into tid from hq_tasks
     where workspace_id = ws and title = p_act->>'title' and status <> 'deleted'
     order by updated_at desc limit 1;
    if tid is null then return '{"ok":false,"why":"no task"}'; end if;
    if (p_act->>'done')::boolean then
      update hq_tasks set status = 'done', done_at = now(), updated_at = now(),
        history = history || jsonb_build_array(jsonb_build_object('at', now(), 'text', '본부 보고서에서 완료'))
       where id = tid and status <> 'done';
    else
      update hq_tasks set status = 'open', done_at = null, updated_at = now(),
        history = history || jsonb_build_array(jsonb_build_object('at', now(), 'text', '본부 보고서에서 완료 취소'))
       where id = tid and status = 'done';
    end if;
    return '{"ok":true}';
  end if;

  if op in ('decide', 'opinion') then
    select id, options into did, opts from hq_decisions
     where workspace_id = ws and question = p_act->>'question'
     order by updated_at desc limit 1;
    if did is null then return '{"ok":false,"why":"no decision"}'; end if;
    if op = 'opinion' then
      update hq_decisions set opinion = nullif(left(coalesce(p_act->>'text', ''), 5000), ''), updated_at = now() where id = did;
    elsif p_act->'picked' is null or jsonb_typeof(p_act->'picked') = 'null' then
      update hq_decisions set status = 'open', picked = null, decided_by = null, decided_at = null, updated_at = now() where id = did;
    elsif opts ? (p_act->>'picked') then
      -- 브리핑 · 보고서에서 고른 결정은 할 일을 만들지 않는다 (본부가 다음 날 이어 받는다)
      update hq_decisions set status = 'decided', picked = p_act->>'picked', make_task = false,
        decided_by = null, decided_at = now(), updated_at = now() where id = did;
    else
      return '{"ok":false,"why":"not an option"}';
    end if;
    return '{"ok":true}';
  end if;

  if op = 'memo' then
    txt := p_act->>'slot';
    if coalesce(txt, '') not in ('top', 'free', 'brand') or d is null then return '{"ok":false,"why":"bad slot"}'; end if;
    update hq_briefings
       set memos = case when coalesce(p_act->>'text', '') = '' then memos - txt
                        else jsonb_set(memos, array[txt], to_jsonb(left(p_act->>'text', 5000))) end,
           memos_updated_at = now()
     where workspace_id = ws and date = d and source = 'hq';
    if not found then return '{"ok":false,"why":"no briefing"}'; end if;
    return '{"ok":true}';
  end if;

  raise exception 'hq_act: unknown op %', op using errcode = '22023';
end $$;
revoke all on function hq_act(text, jsonb) from public;
grant execute on function hq_act(text, jsonb) to anon, authenticated;
comment on function hq_act(text, jsonb) is '본부 보고서 → 오피스: 할 일 체크 · 결정 · 의견 · 브리핑 메모 (state 로 지금 상태 읽기). 토큰 워크스페이스 안에서만';

-- ── ③ hq_pull 에 브리핑 메모 ──
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
                     'updated_at', t.updated_at) order by t.updated_at desc), '[]')
                from hq_tasks t where t.workspace_id = ws and (t.status in ('open','proposed') or t.updated_at >= p_since)),
    'decisions', (select coalesce(jsonb_agg(jsonb_build_object('key', x.hq_key, 'question', x.question, 'status', x.status, 'picked', x.picked,
                     'opinion', x.opinion, 'make_task', x.make_task, 'decided_at', x.decided_at)), '[]')
                from hq_decisions x where x.workspace_id = ws and (x.status = 'open' or x.decided_at >= p_since or x.updated_at >= p_since)),
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
