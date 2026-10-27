-- ────────────────────────────────────────────────────────
-- 068: 브리핑 메모 → 댓글 · 할 일 / 결정 이력에 「누가 · 언제」 · 결정 알림 설정 - 2026-10-27 대표 실행
-- ────────────────────────────────────────────────────────
-- 배경 (2026-10-27 대표 요청):
--   · 메모를 저장하면 댓글창처럼 「이름 · 내용 · 시간」 이 남는다 (오피스니까 이력이 남아야)
--   · 할 일을 언제 · 누가 완료했는지, 결정을 언제 · 누가 했는지 보인다
--   · 오피스 폰 알림을 브랜드 오피스에도 맞춘다 (결정 알림 켜고 끄기 칸 하나 추가)
--
-- 이 마이그레이션은
--   ① 댓글은 기존 social_comments 를 그대로 쓴다 (ref_type 셋 추가 - 표는 안 바꿈)
--        hq_briefing  ref_id = '<브리핑 id>:<칸>'   칸 = top · brand · free
--        hq_decision  ref_id = 결정 id
--        hq_task      ref_id = 할 일 id
--   ② hq_tasks.done_by - 누가 완료했는지 (done_at 은 이미 있다)
--   ③ notification_preferences.notify_decision - 「결정」 알림 켜고 끄기 (기본 켬)
--   ④ hq_act 다시 정의 - 메모 · 의견이 덮어쓰기에서 댓글 쌓기로.
--        본부 보고서(이 맥)에서 한 것은 워크스페이스를 만든 사람(대표) 이름으로 남는다
--        state   할 일 {done, at, by} · 결정 {picked, at, by, comments} · 메모 칸 {칸: 댓글[]}
--        task    완료 · 완료 취소 (+ done_by · 이력에 이름)
--        decide  결정 · 취소 (+ decided_by)
--        comment 댓글 달기 - 브리핑 칸 또는 결정 (memo · opinion 도 같은 뜻으로 받는다 - 예전 보고서용)
--        uncomment 내가(대표) 단 댓글 지우기
--      결과에 notify 를 붙여 돌려준다 - 본부 serve.mjs 가 그걸 notify 함수로 넘겨 다른 멤버 폰에 알림
--   ⑤ hq_pull 에 댓글 · 완료한 사람 추가 (다음 날 본부가 읽는다)
--   ⑥ 지금까지 hq_briefings.memos 에 있던 메모는 댓글로 옮긴다 (칸은 남겨 둔다 - 이제 안 씀)
-- 모두 가산적 · 여러 번 돌려도 안전.

-- ── ② ③ 칸 ──
alter table hq_tasks add column if not exists done_by uuid references auth.users(id) on delete set null;
alter table notification_preferences add column if not exists notify_decision boolean not null default true;

-- notify 함수(서버)가 본부 토큰을 확인할 때 쓴다
grant execute on function hq_auth(text) to service_role;

create index if not exists social_comments_ws_created_idx on social_comments(workspace_id, created_at desc);

-- ── 이름 ──
create or replace function hq_member_name(p_ws uuid, p_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(m.nickname), ''), '멤버') from workspace_members m where m.workspace_id = p_ws and m.user_id = p_uid
$$;
revoke all on function hq_member_name(uuid, uuid) from public;

-- 댓글 목록 (오래된 것부터) · mine = p_me 가 단 것 (지울 수 있다)
create or replace function hq_comments_json(p_ws uuid, p_type text, p_ref text, p_me uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'by', coalesce(hq_member_name(p_ws, c.user_id), '멤버'),
           'text', c.content, 'at', c.created_at, 'mine', c.user_id = p_me) order by c.created_at), '[]')
    from social_comments c where c.workspace_id = p_ws and c.ref_type = p_type and c.ref_id = p_ref
$$;
revoke all on function hq_comments_json(uuid, text, text, uuid) from public;

-- ── ⑥ 예전 메모 → 댓글 (한 번만: 같은 글이 이미 있으면 건너뜀) ──
insert into social_comments (ref_type, ref_id, workspace_id, user_id, content, created_at)
select 'hq_briefing', b.id::text || ':' || k.key, b.workspace_id, w.created_by, k.value, coalesce(b.memos_updated_at, now())
  from hq_briefings b
  join workspaces w on w.id = b.workspace_id
  cross join lateral jsonb_each_text(b.memos) k
 where b.memos <> '{}' and k.key in ('top', 'brand', 'free') and trim(k.value) <> ''
   and not exists (select 1 from social_comments c where c.ref_type = 'hq_briefing'
                    and c.ref_id = b.id::text || ':' || k.key and c.content = k.value);

-- ── ④ hq_act ──
create or replace function hq_act(p_token text, p_act jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  ws    uuid := hq_auth(p_token);
  op    text := p_act->>'op';
  d     date := nullif(p_act->>'date', '')::date;
  owner uuid;
  me    text;
  bid   uuid;
  tid   uuid;
  ttl   text;
  did   uuid;
  q     text;
  opts  jsonb;
  slot  text;
  txt   text;
  cid   uuid;
  link  text := '/w/' || ws::text;
begin
  select created_by into owner from workspaces where id = ws;
  me := coalesce(hq_member_name(ws, owner), '대표');
  select id into bid from hq_briefings where workspace_id = ws and date = d and source = 'hq';

  if op = 'state' then
    return jsonb_build_object(
      'tasks', (select coalesce(jsonb_object_agg(t.title, jsonb_build_object('done', t.status = 'done',
                   'at', case when t.status = 'done' then t.done_at end,
                   'by', case when t.status = 'done' and t.done_by is not null then hq_member_name(ws, t.done_by) end)), '{}') from (
                  select distinct on (title) title, status, done_at, done_by from hq_tasks
                   where workspace_id = ws and status <> 'deleted'
                     and title in (select jsonb_array_elements_text(coalesce(p_act->'titles', '[]')))
                   order by title, updated_at desc) t),
      'decisions', (select coalesce(jsonb_object_agg(x.question, jsonb_build_object(
                       'picked', case when x.status = 'decided' then coalesce(x.picked, '') end,
                       'at', case when x.status = 'decided' then x.decided_at end,
                       'by', case when x.status = 'decided' and x.decided_by is not null then hq_member_name(ws, x.decided_by) end,
                       'comments', hq_comments_json(ws, 'hq_decision', x.id::text, owner))), '{}') from (
                  select distinct on (question) id, question, status, picked, decided_at, decided_by from hq_decisions
                   where workspace_id = ws
                     and question in (select jsonb_array_elements_text(coalesce(p_act->'questions', '[]')))
                   order by question, updated_at desc) x),
      'memos', case when bid is null then '{}'::jsonb else jsonb_build_object(
                 'top', hq_comments_json(ws, 'hq_briefing', bid::text || ':top', owner),
                 'brand', hq_comments_json(ws, 'hq_briefing', bid::text || ':brand', owner),
                 'free', hq_comments_json(ws, 'hq_briefing', bid::text || ':free', owner)) end);
  end if;

  if op = 'task' then
    select id, title into tid, ttl from hq_tasks
     where workspace_id = ws and title = p_act->>'title' and status <> 'deleted'
     order by updated_at desc limit 1;
    if tid is null then return '{"ok":false,"why":"no task"}'; end if;
    if (p_act->>'done')::boolean then
      update hq_tasks set status = 'done', done_at = now(), done_by = owner, updated_at = now(),
        history = history || jsonb_build_array(jsonb_build_object('at', now(), 'text', '완료 (본부 보고서)', 'by', me))
       where id = tid and status <> 'done';
      if found then
        return jsonb_build_object('ok', true, 'notify', jsonb_build_object('workspace_id', ws, 'type', 'notify_task_completed',
          'title', '✅ 할 일 완료', 'body', me || ' 님이 「' || ttl || '」 을 완료했어요.', 'url', link || '/tasks/' || tid, 'tag', 'hq-task-' || tid || '-done'));
      end if;
    else
      update hq_tasks set status = 'open', done_at = null, done_by = null, updated_at = now(),
        history = history || jsonb_build_array(jsonb_build_object('at', now(), 'text', '완료 취소 (본부 보고서)', 'by', me))
       where id = tid and status = 'done';
    end if;
    return '{"ok":true}';
  end if;

  if op = 'decide' then
    select id, question, options into did, q, opts from hq_decisions
     where workspace_id = ws and question = p_act->>'question'
     order by updated_at desc limit 1;
    if did is null then return '{"ok":false,"why":"no decision"}'; end if;
    if p_act->'picked' is null or jsonb_typeof(p_act->'picked') = 'null' then
      update hq_decisions set status = 'open', picked = null, decided_by = null, decided_at = null, updated_at = now() where id = did;
      return '{"ok":true}';
    elsif opts ? (p_act->>'picked') then
      -- 브리핑 · 보고서에서 고른 결정은 할 일을 만들지 않는다 (본부가 다음 날 이어 받는다)
      update hq_decisions set status = 'decided', picked = p_act->>'picked', make_task = false,
        decided_by = owner, decided_at = now(), updated_at = now() where id = did;
      return jsonb_build_object('ok', true, 'notify', jsonb_build_object('workspace_id', ws, 'type', 'notify_decision',
        'title', '🧭 결정', 'body', me || ' 님이 「' || left(q, 60) || '」 → ' || (p_act->>'picked'), 'url', link || '/tasks/decide', 'tag', 'hq-decision-' || did));
    end if;
    return '{"ok":false,"why":"not an option"}';
  end if;

  if op in ('comment', 'memo', 'opinion') then
    txt := left(trim(coalesce(p_act->>'text', '')), 5000);
    if txt = '' then return '{"ok":false,"why":"empty"}'; end if;
    if op = 'opinion' or p_act->>'target' = 'decision' then
      select id, question into did, q from hq_decisions
       where workspace_id = ws and question = p_act->>'question' order by updated_at desc limit 1;
      if did is null then return '{"ok":false,"why":"no decision"}'; end if;
      insert into social_comments (ref_type, ref_id, workspace_id, user_id, content)
      values ('hq_decision', did::text, ws, owner, txt) returning id into cid;
      return jsonb_build_object('ok', true, 'id', cid, 'by', me, 'at', now(), 'notify', jsonb_build_object('workspace_id', ws, 'type', 'notify_comment',
        'title', '💬 결정에 댓글', 'body', me || ' 님: ' || left(txt, 80), 'url', link || '/tasks/decide-' || did, 'tag', 'hq-decision-comment-' || cid));
    end if;
    slot := p_act->>'slot';
    if coalesce(slot, '') not in ('top', 'free', 'brand') then return '{"ok":false,"why":"bad slot"}'; end if;
    if bid is null then return '{"ok":false,"why":"no briefing"}'; end if;
    insert into social_comments (ref_type, ref_id, workspace_id, user_id, content)
    values ('hq_briefing', bid::text || ':' || slot, ws, owner, txt) returning id into cid;
    return jsonb_build_object('ok', true, 'id', cid, 'by', me, 'at', now(), 'notify', jsonb_build_object('workspace_id', ws, 'type', 'notify_comment',
      'title', '💬 브리핑 메모', 'body', me || ' 님: ' || left(txt, 80), 'url', link || '/briefing/' || bid, 'tag', 'hq-briefing-comment-' || cid));
  end if;

  if op = 'uncomment' then
    -- 본부 보고서는 대표 이름으로 쓰므로 대표가 단 댓글만, 이 워크스페이스의 브리핑 · 결정 댓글만
    delete from social_comments
     where id = nullif(p_act->>'id', '')::uuid and workspace_id = ws and user_id = owner and ref_type in ('hq_briefing', 'hq_decision');
    return jsonb_build_object('ok', found);
  end if;

  raise exception 'hq_act: unknown op %', op using errcode = '22023';
end $$;
revoke all on function hq_act(text, jsonb) from public;
grant execute on function hq_act(text, jsonb) to anon, authenticated;
comment on function hq_act(text, jsonb) is '본부 보고서 → 오피스: 할 일 체크 · 결정 · 댓글 (state 로 지금 상태 읽기). 토큰 워크스페이스 안에서만. 대표 이름으로 남는다';

-- ── ⑤ hq_pull 에 댓글 · 완료한 사람 ──
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
                     'updated_at', t.updated_at) order by t.updated_at desc), '[]')
                from hq_tasks t where t.workspace_id = ws and (t.status in ('open','proposed') or t.updated_at >= p_since)),
    'decisions', (select coalesce(jsonb_agg(jsonb_build_object('key', x.hq_key, 'question', x.question, 'status', x.status, 'picked', x.picked,
                     'opinion', x.opinion, 'make_task', x.make_task, 'decided_at', x.decided_at,
                     'decided_by', case when x.decided_by is not null then hq_member_name(ws, x.decided_by) end)), '[]')
                from hq_decisions x where x.workspace_id = ws and (x.status = 'open' or x.decided_at >= p_since or x.updated_at >= p_since)),
    -- 댓글: on = briefing(date · slot) · decision(question) · task(title)
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
                  select 'task', null, null, t.title, c.user_id, c.content, c.created_at
                    from social_comments c join hq_tasks t on t.id::text = c.ref_id
                   where c.workspace_id = ws and c.ref_type = 'hq_task' and c.created_at >= p_since) y),
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
