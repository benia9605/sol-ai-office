-- ────────────────────────────────────────────────────────
-- 069: 본부 보고서에서 한 일은 「쏠닝(Sol)」 이름으로 · 아침 알림은 10시 출근 기준 - 2026-10-27 대표 실행
-- ────────────────────────────────────────────────────────
-- 배경 (2026-10-27):
--   · 068 은 본부 보고서(이 맥 Cursor)에서 한 일을 「워크스페이스를 만든 사람」 이름으로 남겼다.
--     시목은 홍민석님이 만든 워크스페이스라 쏠닝이 쓴 댓글이 홍민석 이름으로 남았다 (시험 댓글 1개 - 지웠음).
--     → 본부 토큰마다 「본부 보고서를 쓰는 사람」 을 정해 둔다 (ingest_credentials.actor_user_id)
--       = 쏠닝포인트 워크스페이스를 만든 사람(쏠닝). 그 워크스페이스 멤버가 아니면 예전처럼 만든 사람
--   · 대표 결정: 출근이 10시라 아침 알림은 10시 기준 (pg_cron 시간만 바꾼다)
--        아침 브리핑 요약 08:00 → 10:00 · 할 일 마감 10:01 (그대로) · 아침 루틴 09:00 → 10:03 · 아침 일기 09:05 → 10:05
--     본부 보고서는 09:00 그대로 (만드는 데 30분쯤 걸려 9시 반 전후 도착 · 10시에 확인)
-- 가산적 · 여러 번 돌려도 안전.

-- ── ① 본부 보고서를 쓰는 사람 ──
alter table ingest_credentials add column if not exists actor_user_id uuid references auth.users(id) on delete set null;
comment on column ingest_credentials.actor_user_id is '본부 토큰으로 한 일(체크 · 결정 · 댓글)을 누구 이름으로 남길지. 비면 워크스페이스를 만든 사람';

update ingest_credentials c
   set actor_user_id = (select created_by from workspaces where hq_brand_key = 'solningpoint' limit 1)
 where c.name = 'sol-hq' and 'hq:ingest' = any(c.scopes) and c.actor_user_id is null;

create or replace function hq_actor(p_ws uuid, p_token text)
returns uuid language sql stable security definer set search_path = public, extensions as $$
  select coalesce(
    (select c.actor_user_id from ingest_credentials c
      where c.workspace_id = p_ws and c.token_sha256 = encode(extensions.digest(p_token, 'sha256'), 'hex') and c.actor_user_id is not null
        and exists (select 1 from workspace_members m where m.workspace_id = p_ws and m.user_id = c.actor_user_id) limit 1),
    (select created_by from workspaces where id = p_ws))
$$;
revoke all on function hq_actor(uuid, text) from public, anon, authenticated;

-- ── ② hq_act - 068 과 같고, 이름만 「본부 보고서를 쓰는 사람」 으로 ──
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
  owner := hq_actor(ws, p_token);
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
        return jsonb_build_object('ok', true, 'notify', jsonb_build_object('workspace_id', ws, 'actor_id', owner, 'type', 'notify_task_completed',
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
      return jsonb_build_object('ok', true, 'notify', jsonb_build_object('workspace_id', ws, 'actor_id', owner, 'type', 'notify_decision',
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
      return jsonb_build_object('ok', true, 'id', cid, 'by', me, 'at', now(), 'notify', jsonb_build_object('workspace_id', ws, 'actor_id', owner, 'type', 'notify_comment',
        'title', '💬 결정에 댓글', 'body', me || ' 님: ' || left(txt, 80), 'url', link || '/tasks/decide-' || did, 'tag', 'hq-decision-comment-' || cid));
    end if;
    slot := p_act->>'slot';
    if coalesce(slot, '') not in ('top', 'free', 'brand') then return '{"ok":false,"why":"bad slot"}'; end if;
    if bid is null then return '{"ok":false,"why":"no briefing"}'; end if;
    insert into social_comments (ref_type, ref_id, workspace_id, user_id, content)
    values ('hq_briefing', bid::text || ':' || slot, ws, owner, txt) returning id into cid;
    return jsonb_build_object('ok', true, 'id', cid, 'by', me, 'at', now(), 'notify', jsonb_build_object('workspace_id', ws, 'actor_id', owner, 'type', 'notify_comment',
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
comment on function hq_act(text, jsonb) is '본부 보고서 → 오피스: 할 일 체크 · 결정 · 댓글 (state 로 지금 상태 읽기). 토큰 워크스페이스 안에서만. 본부 보고서를 쓰는 사람(ingest_credentials.actor_user_id) 이름으로 남는다';


-- ── ③ 아침 알림 10시 기준 (KST = UTC + 9) ──
select cron.alter_job(jobid, schedule := '0 1 * * *') from cron.job where jobname = 'morning-briefing';  -- 10:00
select cron.alter_job(jobid, schedule := '3 1 * * *') from cron.job where jobname = 'morning-routine';   -- 10:03
select cron.alter_job(jobid, schedule := '5 1 * * *') from cron.job where jobname = 'morning-journal';   -- 10:05
-- 확인: select jobname, schedule from cron.job order by jobname;
