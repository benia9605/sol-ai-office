/**
 * @file src/brand/views/TasksView.tsx
 * @description 03 할 일 - 탭 셋 (할 일 · 결정 대기 · 제안). 추가는 위 「+ 할 일」 버튼만.
 *  - 직접 적은 할 일은 본부 할 일과 같은 목록에 「직접」 뱃지로
 *  - 일정을 정하면 「예정」 에 있다가 그날 「오늘」 로 (못 하면 다음 날도 오늘에 남고 「이월」)
 *  - 담당은 워크스페이스 멤버 이름 그대로 + 공동
 *  - 결정은 하나 고르고 의견 → 원하면 고른 안으로 할 일 생성. 본부는 다음 날 hq_pull 로 읽는다
 * 주소: /w/:id/tasks/(new | decide | propose | decide-<id> | <task id>)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrandViewProps } from '../BrandShell';
import { Decision, HqTask, addTask, decide, doneDay, fmtDay, fmtTime, listDecisions, listTasks, listTasksMonth, todayKst, updateTask } from '../hq.service';
import { Act, AssigneeSeg, Badge, Card, Check, DueSeg, Empty, Err, Field, Kind, List, Mini, NoHit, PageHead, Pager, Panel, Row, Sec, Seg, Skeleton, Tabs, Thread, DueKindBadge, hay, matchSearch, memberName, usePaged } from '../ui';
import { isCarry, isToday } from './TodayView';

type Tab = 'todo' | 'decide' | 'propose';
const shiftMonth = (m: string, d: number) => { const [y, mm] = m.split('-').map(Number); const t = new Date(Date.UTC(y, mm - 1 + d, 1)); return t.toISOString().slice(0, 7); };

export function TasksView({ workspace, members, myId, detailId, go }: BrandViewProps) {
  const ws = workspace.id;
  const today = todayKst(), tomorrow = todayKst(1);
  const [tasks, setTasks] = useState<HqTask[] | null>(null);
  const [monthTasks, setMonthTasks] = useState<HqTask[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [q, setQ] = useState('');
  const [month, setMonth] = useState(today.slice(0, 7));
  const [day, setDay] = useState(today);

  const load = useCallback(async () => {
    try { const [t, d] = await Promise.all([listTasks(ws), listDecisions(ws)]); setTasks(t); setDecisions(d); setErr(null); }
    catch (e) { setErr(e); }
  }, [ws]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { listTasksMonth(ws, month).then(setMonthTasks).catch(() => setMonthTasks([])); }, [ws, month]);

  const tab: Tab = detailId === 'decide' || detailId?.startsWith('decide-') ? 'decide' : detailId === 'propose' || detailId?.startsWith('propose-') ? 'propose' : 'todo';
  const all = useMemo(() => { const m = new Map<string, HqTask>(); [...monthTasks, ...(tasks ?? [])].forEach(t => m.set(t.id, t)); return [...m.values()]; }, [tasks, monthTasks]);
  const hit = (t: HqTask) => matchSearch(hay(t.title, t.why, t.sourceLabel, t.assigneeShared ? '공동' : memberName(members, t.assigneeUserId), t.memo), q);
  const open = (tasks ?? []).filter(t => t.status === 'open' || t.status === 'done');
  const todays = open.filter(t => isToday(t, today));
  // 달력에서 고른 날 - 오늘이면 「오늘 할 일」(일정 없는 것 · 이월 포함), 다른 날이면 그날 일정 · 그날 끝낸 것
  const dayList = (day === today ? todays : all.filter(t => t.dueDate === day || doneDay(t) === day)).filter(hit);
  const later = open.filter(t => t.status === 'open' && t.dueDate && t.dueDate > today && hit(t)).sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));
  const proposals = (tasks ?? []).filter(t => t.status === 'proposed' && hit(t));
  const openDecisions = decisions.filter(d => d.status === 'open' && matchSearch(hay(d.question, d.why, d.options), q));
  const pgDay = usePaged(dayList), pgLater = usePaged(later), pgDec = usePaged(openDecisions), pgProp = usePaged(proposals);

  const replace = (t: HqTask) => { setTasks(ts => (ts ?? []).map(x => (x.id === t.id ? t : x))); setMonthTasks(ts => ts.map(x => (x.id === t.id ? t : x))); };
  const toggle = async (t: HqTask) => replace(await updateTask(t, { status: t.status === 'done' ? 'open' : 'done' }, t.status === 'done' ? '완료 취소' : '완료'));

  const selTask = all.find(t => t.id === detailId || `propose-${t.id}` === detailId);
  const selDecision = decisions.find(d => `decide-${d.id}` === detailId);
  const close = () => go('tasks', tab === 'todo' ? undefined : tab);

  const rowFor = (t: HqTask) => (
    <Row key={t.id} done={t.status === 'done'} onClick={() => go('tasks', t.id)}
      left={<Check on={t.status === 'done'} onToggle={() => toggle(t)} label="완료" />}
      title={t.title}
      desc={[t.why, t.assigneeShared ? '공동' : memberName(members, t.assigneeUserId),
        t.status === 'done' && t.doneAt ? `완료 ${[memberName(members, t.doneBy), fmtTime(t.doneAt)].filter(Boolean).join(' ')}` : ''].filter(Boolean).join(' · ')}
      right={<><DueKindBadge kind={t.dueKind} /><Badge source={isCarry(t, today) ? 'carry' : t.source} /></>} />
  );
  const laterGroups = useMemo(() => {
    const m = new Map<string, HqTask[]>();
    pgLater.shown.forEach(t => m.set(t.dueDate!, [...(m.get(t.dueDate!) ?? []), t]));
    return [...m];
  }, [pgLater.shown]);

  return (
    <>
      <PageHead title="할 일" search={{ value: q, onChange: setQ, placeholder: '할 일 · 결정 검색' }} action={<Act onClick={() => go('tasks', 'new')}>+ 할 일</Act>} />
      <Tabs<Tab> value={tab} onChange={k => go('tasks', k === 'todo' ? undefined : k)} items={[
        { key: 'todo', label: '할 일', count: todays.length },
        { key: 'decide', label: '결정 대기', count: openDecisions.length },
        { key: 'propose', label: '제안', count: proposals.length },
      ]} />
      {!!err && <Err e={err} />}
      {!tasks ? <Skeleton /> : tab === 'todo' ? (
        <>
          <TaskCalendar month={month} onMonth={m => { setMonth(m); setDay(m === today.slice(0, 7) ? today : `${m}-01`); }} tasks={all} today={today} picked={day} onPick={setDay} />
          <Sec title={day === today ? '오늘' : fmtDay(day)} count={`${day === today ? `${fmtDay(today)} · ` : ''}${dayList.length}`}
            link={day !== today ? '오늘로 ↺' : undefined} onLink={() => { setMonth(today.slice(0, 7)); setDay(today); }}>
            <Card>{dayList.length ? <List>{pgDay.shown.map(t => rowFor(t))}</List> : q ? <NoHit q={q} /> : <Empty>{day === today ? '오늘 할 일 없음' : '이날 할 일 없음'}</Empty>}</Card>
            <Pager {...pgDay} />
          </Sec>
          <Sec title="예정" count={later.length}>
            <Card>{laterGroups.length ? laterGroups.map(([d, list]) => (
              <div key={d}><div className="n-day">{fmtDay(d)}</div><List>{list.map(t => rowFor(t))}</List></div>
            )) : q ? <NoHit q={q} /> : <Empty>예정된 할 일 없음</Empty>}</Card>
            <Pager {...pgLater} />
          </Sec>
        </>
      ) : tab === 'decide' ? (
        <Sec title="결정 대기" count={openDecisions.length}>
          <Card>{openDecisions.length ? <List>{pgDec.shown.map(d => (
            <Row key={d.id} onClick={() => go('tasks', `decide-${d.id}`)} title={d.question}
              desc={<><div className="n-opts">{d.options.map(o => <span key={o} className="n-opt">{o}</span>)}</div><div className="n-ans">의견 입력</div></>}
              left={<Kind>{fmtDay(d.date, false)}</Kind>} />
          ))}</List> : q ? <NoHit q={q} /> : <Empty>결정 대기 없음</Empty>}</Card>
          <Pager {...pgDec} />
        </Sec>
      ) : (
        <Sec title="제안" count={proposals.length}>
          <Card>{proposals.length ? <List>{pgProp.shown.map(t => (
            <Row key={t.id} title={t.title} desc={t.why} onClick={() => go('tasks', `propose-${t.id}`)}
              right={<><Mini onClick={async () => replace(await updateTask(t, { status: 'held' }, '보류'))}>보류</Mini><Mini primary onClick={() => go('tasks', `propose-${t.id}`)}>승인</Mini></>} />
          ))}</List> : q ? <NoHit q={q} /> : <Empty>제안 없음</Empty>}</Card>
          <Pager {...pgProp} />
        </Sec>
      )}

      {detailId === 'new' && <TaskPanel title="할 일 추가" members={members} myId={myId} today={today} tomorrow={tomorrow} onClose={close}
        onSave={async f => { const t = await addTask(ws, f); setTasks(ts => [...(ts ?? []), t]); if (t.dueDate?.startsWith(month)) setMonthTasks(ts => [...ts, t]); close(); }} />}
      {selTask && selTask.status !== 'proposed' && <TaskPanel title="할 일" task={selTask} members={members} myId={myId} today={today} tomorrow={tomorrow} onClose={close}
        onSave={async f => { replace(await updateTask(selTask, taskPatch(f), '수정')); close(); }}
        onDone={async f => { const done = selTask.status !== 'done'; replace(await updateTask(selTask, { ...taskPatch(f), status: done ? 'done' : 'open' }, done ? '완료' : '완료 취소')); close(); }}
        onDelete={async () => { await updateTask(selTask, { status: 'deleted' }, '삭제'); setTasks(ts => (ts ?? []).filter(x => x.id !== selTask.id)); setMonthTasks(ts => ts.filter(x => x.id !== selTask.id)); close(); }} />}
      {selTask && selTask.status === 'proposed' && <ApprovePanel task={selTask} members={members} myId={myId} today={today} tomorrow={tomorrow} onClose={close}
        onHold={async () => { replace(await updateTask(selTask, { status: 'held' }, '보류')); close(); }}
        onApprove={async f => { replace(await updateTask(selTask, { status: 'open', dueDate: f.dueDate ?? '', assigneeUserId: f.assigneeUserId ?? '', assigneeShared: !!f.assigneeShared }, '제안 승인')); close(); }} />}
      {selDecision && <DecisionPanel ws={ws} d={selDecision} members={members} myId={myId} onClose={close}
        onSubmit={async f => { await decide(ws, selDecision, f); await load(); close(); }} />}
    </>
  );
}

interface TaskForm { title: string; dueDate?: string; assigneeUserId?: string; assigneeShared?: boolean; memo?: string }
const taskPatch = (f: TaskForm) => ({ title: f.title, dueDate: f.dueDate ?? '', assigneeUserId: f.assigneeUserId ?? '', assigneeShared: !!f.assigneeShared, memo: f.memo ?? '' });
function TaskPanel({ title, task, members, myId, today, tomorrow, onClose, onSave, onDone, onDelete }: {
  title: string; task?: HqTask; members: BrandViewProps['members']; myId: string; today: string; tomorrow: string;
  onClose: () => void; onSave: (f: TaskForm) => Promise<void>; onDone?: (f: TaskForm) => Promise<void>; onDelete?: () => Promise<void>;
}) {
  const [f, setF] = useState<TaskForm>(() => ({ title: task?.title ?? '', dueDate: task?.dueDate, assigneeUserId: task?.assigneeUserId ?? (task ? undefined : myId), assigneeShared: task?.assigneeShared, memo: task?.memo ?? '' }));
  const [busy, setBusy] = useState(false);
  const run = (fn: () => Promise<void>) => async () => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  return (
    <Panel title={title} tag={task ? (task.source === 'hq' ? '자동' : undefined) : undefined} onClose={onClose}
      foot={<>{onDelete && <Act ghost onClick={run(onDelete)} disabled={busy}>삭제</Act>}<span className="grow" />
        <Act ghost={!!onDone} onClick={run(() => onSave(f))} disabled={busy || !f.title.trim()}>{!task ? '추가' : task.status === 'done' ? '저장' : '임시저장'}</Act>
        {onDone && <Act onClick={run(() => onDone(f))} disabled={busy || !f.title.trim()}>{task?.status === 'done' ? '저장 + 완료 취소' : '저장 + 할 일 완료'}</Act>}</>}>
      <Field label="제목"><input className="n-in" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="할 일 입력" autoFocus={!task} /></Field>
      <Field label="일정"><DueSeg value={f.dueDate} onChange={d => setF({ ...f, dueDate: d })} today={today} tomorrow={tomorrow} /></Field>
      <Field label="담당"><AssigneeSeg members={members} userId={f.assigneeUserId} shared={!!f.assigneeShared} onChange={v => setF({ ...f, assigneeUserId: v.userId, assigneeShared: v.shared })} /></Field>
      {task?.why && <Field label="근거"><div className="n-box">{task.why}{task.sourceLabel && <><br /><span style={{ color: 'var(--muted)' }}>출처 · {task.sourceLabel}</span></>}</div></Field>}
      <Field label="메모"><textarea className="n-in area" rows={3} value={f.memo} onChange={e => setF({ ...f, memo: e.target.value })} placeholder="선택 입력" /></Field>
      {task && <Field label="댓글"><Thread ws={task.workspaceId} refType="hq_task" refId={task.id} members={members} myId={myId} about={{ label: '할 일에 댓글', path: `/tasks/${task.id}` }} /></Field>}
      {task && task.history.length > 0 && <Field label="이력"><List>{[...task.history].reverse().map((h, i) => (
        <Row key={i} left={<Kind>{fmtTime(h.at)}</Kind>} title={<span className="d" style={{ margin: 0 }}>{h.text}{h.by && <> · {h.by}</>}</span>} />
      ))}</List></Field>}
    </Panel>
  );
}

function ApprovePanel({ task, members, myId, today, tomorrow, onClose, onHold, onApprove }: {
  task: HqTask; members: BrandViewProps['members']; myId: string; today: string; tomorrow: string;
  onClose: () => void; onHold: () => Promise<void>; onApprove: (f: TaskForm) => Promise<void>;
}) {
  const [f, setF] = useState<TaskForm>({ title: task.title, assigneeUserId: myId });
  return (
    <Panel title="제안 승인" onClose={onClose} foot={<><Act ghost onClick={onHold}>보류</Act><span className="grow" /><Act onClick={() => onApprove(f)}>할 일로 추가</Act></>}>
      <h3 className="n-ttl">{task.title}</h3>
      {task.why && <div className="n-sub" style={{ marginTop: -6 }}>{task.why}</div>}
      <Field label="일정"><DueSeg value={f.dueDate} onChange={d => setF({ ...f, dueDate: d })} today={today} tomorrow={tomorrow} /></Field>
      <Field label="담당"><AssigneeSeg members={members} userId={f.assigneeUserId} shared={!!f.assigneeShared} onChange={v => setF({ ...f, assigneeUserId: v.userId, assigneeShared: v.shared })} /></Field>
    </Panel>
  );
}

function DecisionPanel({ ws, d, members, myId, onClose, onSubmit }: {
  ws: string; d: Decision; members: BrandViewProps['members']; myId: string; onClose: () => void;
  onSubmit: (f: { picked?: string; opinion?: string; makeTask: boolean; assigneeUserId?: string; status: 'decided' | 'held' }) => Promise<void>;
}) {
  const [picked, setPicked] = useState<string | undefined>(d.picked);
  const [opinion, setOpinion] = useState('');
  const [makeTask, setMakeTask] = useState(true);
  const [assignee, setAssignee] = useState<string | undefined>(myId);
  const [busy, setBusy] = useState(false);
  const submit = async (status: 'decided' | 'held') => { setBusy(true); try { await onSubmit({ picked, opinion: opinion.trim() || undefined, makeTask, assigneeUserId: assignee, status }); } finally { setBusy(false); } };
  return (
    <Panel title="결정 대기" tag={fmtDay(d.date, false)} onClose={onClose}
      foot={<><Act ghost onClick={() => submit('held')} disabled={busy}>보류</Act><span className="grow" /><Act onClick={() => submit('decided')} disabled={busy || (!picked && !opinion.trim())}>결정</Act></>}>
      <h3 className="n-ttl">{d.question}</h3>
      {d.why && <div className="n-sub" style={{ marginTop: -6 }}>{d.why}</div>}
      <Field label="선택"><Seg col items={d.options.map(o => ({ key: o, label: `${picked === o ? '● ' : '○ '}${o}` }))} value={picked} onChange={setPicked} /></Field>
      {d.status === 'held' && d.decidedAt && <div className="n-sub">보류 · {memberName(members, d.decidedBy) || '본부'} · {fmtTime(d.decidedAt)}</div>}
      <Field label="댓글"><Thread ws={ws} refType="hq_decision" refId={d.id} members={members} myId={myId} about={{ label: '결정에 댓글', path: `/tasks/decide-${d.id}` }} /></Field>
      <Field label="결정하면서 남길 말"><textarea className="n-in area" rows={2} value={opinion} onChange={e => setOpinion(e.target.value)} placeholder="선택 입력 - 결정과 함께 댓글로 남는다" /></Field>
      <Field label="후속 할 일">
        <div className="n-box acc">
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={makeTask} onChange={e => setMakeTask(e.target.checked)} /> 선택한 안으로 할 일 생성 · 오늘</label>
          {makeTask && <div style={{ marginTop: 10 }}><AssigneeSeg members={members} userId={assignee} shared={false} onChange={v => setAssignee(v.userId)} /></div>}
        </div>
      </Field>
    </Panel>
  );
}

/** 할 일 달력 (2026-10-27 대표 요청 · 시목 판매현황 날짜별 달력 모양) - 날을 누르면 아래 목록이 그날로.
 *  칸: 남은 일 수 · 끝낸 수(✓). 약속 날짜가 지났는데 남은 날은 붉게 */
function TaskCalendar({ month, onMonth, tasks, today, picked, onPick }: {
  month: string; onMonth: (m: string) => void; tasks: HqTask[]; today: string; picked: string; onPick: (d: string) => void;
}) {
  const [y, m] = month.split('-').map(Number);
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  while (cells.length % 7) cells.push(null);
  const stat = useMemo(() => {
    const s = new Map<string, { open: number; done: number; late: boolean }>();
    const at = (d: string) => { if (!s.has(d)) s.set(d, { open: 0, done: 0, late: false }); return s.get(d)!; };
    for (const t of tasks) {
      if (t.status === 'done') { const d = doneDay(t); if (d?.startsWith(month)) at(d).done++; }
      else if (t.status === 'open' && t.dueDate?.startsWith(month)) { const c = at(t.dueDate); c.open++; if (t.dueDate < today) c.late = true; }
    }
    return s;
  }, [tasks, month, today]);
  const arrow = (d: string) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
  return (
    <div className="n-cal">
      <div className="n-calh">
        <b>{y}년 {m}월</b>
        <span className="n-pager" style={{ margin: 0 }}>
          <button type="button" aria-label="이전 달" onClick={() => onMonth(shiftMonth(month, -1))}>{arrow('m15 18-6-6 6-6')}</button>
          <button type="button" aria-label="다음 달" onClick={() => onMonth(shiftMonth(month, 1))}>{arrow('m9 18 6-6-6-6')}</button>
        </span>
      </div>
      <div className="n-calg">
        {'일월화수목금토'.split('').map(w => <span key={w} className="w">{w}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const c = stat.get(d);
          return (
            <button key={d} type="button" onClick={() => onPick(d)}
              className={`c${d === today ? ' today' : ''}${d === picked ? ' on' : ''}${c?.late ? ' late' : ''}${c?.open ? ' has' : ''}`}>
              <b>{Number(d.slice(8))}</b>
              <span>{c?.open ? <em>{c.open}</em> : null}{c?.done ? <i>✓{c.done}</i> : null}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
