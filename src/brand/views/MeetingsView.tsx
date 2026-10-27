/**
 * @file src/brand/views/MeetingsView.tsx
 * @description 회의 - 본부가 회의록 텍스트(클로바노트)로 만든 회의 HTML · 그 회의에서 나온 할 일 진행 · 댓글 (마이그 072)
 *  - 할 일은 본부가 바로 「할 일」 에 넣는다 (담당 · 날짜). 여기서는 회의별로 모아 본다
 *  - 약속 = 회의에서 정한 날짜 (지나도 안 끝나면 「밀림」) · 추천 = 「해 보자」 만 한 것에 본부가 나눠 넣은 날짜
 *  - 아버님(하우) 할 일은 회의 HTML 에만 있다 (오피스 멤버가 아니라서)
 * 주소: /w/:id/meetings/(<회의 id>)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BrandViewProps } from '../BrandShell';
import { HqTask, Meeting, fmtDay, getMeetingHtml, listMeetingTasks, listMeetings, todayKst, updateTask } from '../hq.service';
import { Act, Card, Check, DueKindBadge, Empty, Err, Kind, List, PageHead, Row, Sec, Skeleton, Thread, memberName, useEsc, useLockScroll } from '../ui';

/** 회의 할 일 하나의 지금 상태 - 끝남 · 밀림(약속 날짜 지남) · 아직 */
export function meetingTaskState(t: HqTask, today: string): 'done' | 'late' | 'open' {
  if (t.status === 'done') return 'done';
  return t.dueKind === 'promised' && t.dueDate && t.dueDate < today ? 'late' : 'open';
}

function MeetingModal({ m, onClose }: { m: Meeting; onClose: () => void }) {
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  useLockScroll();
  useEsc(onClose);
  useEffect(() => { getMeetingHtml(m.id).then(setHtml).catch(setErr); }, [m.id]);
  return (
    <>
      <div className="n-dim" onClick={onClose} />
      <div className="n-modal" role="dialog" aria-modal="true" aria-label="회의록">
        <div className="n-ph"><span className="n-b hq">{fmtDay(m.date, false)}</span><b>{m.title}</b><button type="button" className="x" aria-label="닫기" onClick={onClose}>✕</button></div>
        {err ? <div style={{ padding: 20 }}><Err e={err} /></div>
          : html === null ? <div style={{ padding: 20 }}><Skeleton /></div>
          // 본부가 만든 HTML 통째로 - 출처를 떼어 낸 sandbox 안에서만 (오피스 쿠키 · API 를 못 만진다)
          : html ? <iframe ref={frame} title="회의록" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" srcDoc={html} />
          : <div style={{ padding: 20 }}><Empty>본문 없음</Empty></div>}
      </div>
    </>
  );
}

export function MeetingsView({ workspace, members, myId, detailId, go }: BrandViewProps) {
  const ws = workspace.id;
  const today = todayKst();
  const [items, setItems] = useState<Meeting[] | null>(null);
  const [tasks, setTasks] = useState<HqTask[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [reading, setReading] = useState(false);

  const load = useCallback(async () => {
    try {
      const ms = await listMeetings(ws);
      setItems(ms);
      setTasks(await listMeetingTasks(ws, ms.slice(0, 20).map(m => m.id)));
      setErr(null);
    } catch (e) { setErr(e); }
  }, [ws]);
  useEffect(() => { load(); }, [load]);

  const sel = items?.find(m => m.id === detailId) ?? null;
  const tasksOf = (id: string) => tasks.filter(t => t.meetingId === id);
  const toggle = async (t: HqTask) => {
    const next = await updateTask(t, { status: t.status === 'done' ? 'open' : 'done' }, t.status === 'done' ? '완료 취소' : '완료');
    setTasks(ts => ts.map(x => (x.id === t.id ? next : x)));
  };
  const tally = (list: HqTask[]) => {
    const s = list.map(t => meetingTaskState(t, today));
    return { done: s.filter(x => x === 'done').length, late: s.filter(x => x === 'late').length, all: list.length };
  };

  if (sel) {
    const list = tasksOf(sel.id);
    const c = tally(list);
    const hau: string[] = Array.isArray(sel.meta?.hau_tasks) ? sel.meta.hau_tasks.map((x: any) => (typeof x === 'string' ? x : x?.title)).filter(Boolean) : [];
    return (
      <>
        <PageHead title={sel.title} small={fmtDay(sel.date)} action={<><Act ghost onClick={() => go('meetings')}>← 목록</Act><Act onClick={() => setReading(true)}>회의록 열기 ↗</Act></>} />
        {!!err && <Err e={err} />}
        {sel.summary && <Card pad><div className="n-sub" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{sel.summary}</div></Card>}
        <Sec title="우리 할 일" count={`${c.done}/${c.all} 끝남${c.late ? ` · 밀림 ${c.late}` : ''}`} link="할 일 메뉴 ↗" onLink={() => go('tasks')}>
          <Card>{list.length ? <List>{list.map(t => {
            const st = meetingTaskState(t, today);
            return (
              <Row key={t.id} done={st === 'done'} onClick={() => go('tasks', t.id)}
                left={<Check on={st === 'done'} onToggle={() => toggle(t)} label="완료" />}
                title={t.title}
                desc={[t.assigneeShared ? '공동' : memberName(members, t.assigneeUserId), t.dueDate ? fmtDay(t.dueDate) : '', st === 'late' ? '밀림' : ''].filter(Boolean).join(' · ')}
                right={<DueKindBadge kind={t.dueKind} />} />
            );
          })}</List> : <Empty>이 회의에서 나온 할 일 없음</Empty>}</Card>
        </Sec>
        {hau.length > 0 && <Sec title="아버님(하우) 할 일" count={`${hau.length} · 회의록에만`}>
          <Card><List>{hau.map((h, i) => <Row key={i} left={<Kind>하우</Kind>} title={h} />)}</List></Card>
        </Sec>}
        <Sec title="댓글"><Card pad><Thread ws={ws} refType="hq_meeting" refId={sel.id} members={members} myId={myId} about={{ label: '회의에 댓글', path: `/meetings/${sel.id}` }} /></Card></Sec>
        {reading && <MeetingModal m={sel} onClose={() => setReading(false)} />}
      </>
    );
  }

  return (
    <>
      <PageHead title="회의" small="매주 화요일 · 클로바노트 → 본부가 정리" />
      {!!err && <Err e={err} />}
      {!items ? <Skeleton /> : !items.length ? <Card pad><Empty>아직 회의록이 없어요. 회의 텍스트를 본부(Claude Code)에 「시목 회의록」 하고 붙여 주면 여기로 들어와요.</Empty></Card> : (
        <Sec title="회의록" count={items.length}>
          <Card><List>{items.map(m => {
            const c = tally(tasksOf(m.id));
            return (
              <Row key={m.id} onClick={() => go('meetings', m.id)} left={<Kind>{fmtDay(m.date, false)}</Kind>} title={m.title}
                desc={[m.summary?.split('\n')[0], c.all ? `할 일 ${c.done}/${c.all} 끝남` : '', c.late ? `밀림 ${c.late}` : ''].filter(Boolean).join(' · ')}
                right={c.late ? <span className="n-b late">밀림 {c.late}</span> : undefined} />
            );
          })}</List></Card>
        </Sec>
      )}
    </>
  );
}
