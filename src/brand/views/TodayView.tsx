/**
 * @file src/brand/views/TodayView.tsx
 * @description 01 오늘 - 브리핑 요약 · 어제 실적 · 오늘 할 일 · 결정 대기 · 어제 작업
 * 데이터: 본부 꾸러미 (hq_briefings.meta · hq_metrics · hq_tasks · hq_decisions). 할 일 체크는 03 과 같은 데이터.
 */
import { useCallback, useEffect, useState } from 'react';
import { BrandViewProps } from '../BrandShell';
import { Briefing, Decision, HqTask, Metrics, fmtDay, fmtFull, listBriefings, listDecisions, listMetrics, listTasks, todayKst, updateTask } from '../hq.service';
import { Act, Badge, Card, Check, Empty, Err, G2, Kind, List, PageHead, Row, Sec, Skeleton } from '../ui';
import { MetricsStrip } from './MetricsView';
import { BriefingModal } from './BriefingView';

/** 오늘 목록 = 진행 중 · 오늘 끝낸 할 일 중 일정이 없거나 오늘까지인 것 */
export function isToday(t: HqTask, today: string) { return (t.status === 'open' || t.status === 'done') && (!t.dueDate || t.dueDate <= today); }
export function isCarry(t: HqTask, today: string) { return t.source === 'hq' && t.createdAt.slice(0, 10) < today; }

export function TodayView({ workspace, look, go }: BrandViewProps) {
  const ws = workspace.id;
  const today = todayKst();
  const [brief, setBrief] = useState<Briefing | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [tasks, setTasks] = useState<HqTask[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Briefing | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, m, t, d] = await Promise.all([listBriefings(ws, 1), listMetrics(ws, 7), listTasks(ws), listDecisions(ws)]);
      setBrief(b[0] ?? null); setMetrics(m[0] ?? null); setTasks(t); setDecisions(d.filter(x => x.status === 'open')); setErr(null);
    } catch (e) { setErr(e); } finally { setLoading(false); }
  }, [ws]);
  useEffect(() => { load(); }, [load]);

  const todays = tasks.filter(t => isToday(t, today));
  const toggle = async (t: HqTask) => {
    const next = await updateTask(t, { status: t.status === 'done' ? 'open' : 'done' }, t.status === 'done' ? '완료 취소' : '완료');
    setTasks(ts => ts.map(x => (x.id === t.id ? next : x)));
  };
  const work: { kind: string; title: string; detail?: string }[] = Array.isArray(brief?.meta?.work) ? brief!.meta.work : [];

  if (loading) return <><PageHead title="오늘" small={fmtFull(today)} /><Skeleton /></>;
  return (
    <>
      <PageHead title="오늘" small={fmtFull(today)}
        action={brief && <Act ghost onClick={() => setOpen(brief)}>브리핑 열기 ↗</Act>} />
      {!!err && <Err e={err} />}

      <section className="simok-hero n-hero">
        <div className="simok-hero-copy">
          <div className="simok-eyebrow">MORNING BRIEF — {(brief?.date ?? today).replace(/-/g, '.')}</div>
          <h2>{brief?.summary || brief?.title || '아직 오늘 브리핑이 없습니다'}</h2>
          <p>할 일 {todays.length} · 결정 대기 {decisions.length}</p>
        </div>
        {look.heroImage
          ? <div className="simok-hero-image"><img src={look.heroImage} alt="" /><span className="simok-hero-caption">GOOD THINGS TAKE TIME.</span></div>
          : <div className="n-hero-type"><div><b>{look.heroWord}</b><span>{look.motto}</span></div></div>}
      </section>

      <Sec title="어제 실적" count={metrics ? fmtDay(metrics.date) : ''} link="자세히 ↗" onLink={() => go('metrics')}>
        {metrics ? <MetricsStrip items={metrics.items} /> : <Card><Empty>실적 기록 없음</Empty></Card>}
      </Sec>

      <G2>
        <Sec title="오늘 할 일" count={todays.length} link="전체 ↗" onLink={() => go('tasks')}>
          <Card>
            {todays.length ? <List>{todays.slice(0, 6).map(t => (
              <Row key={t.id} done={t.status === 'done'} onClick={() => go('tasks', t.id)}
                left={<Check on={t.status === 'done'} onToggle={() => toggle(t)} label="완료" />}
                title={t.title} desc={t.why} right={<Badge source={isCarry(t, today) ? 'carry' : t.source} />} />
            ))}</List> : <Empty>오늘 할 일 없음</Empty>}
          </Card>
        </Sec>
        <Sec title="결정 대기" count={decisions.length} link="전체 ↗" onLink={() => go('tasks', 'decide')}>
          <Card>
            {decisions.length ? <List>{decisions.slice(0, 4).map(d => (
              <Row key={d.id} onClick={() => go('tasks', `decide-${d.id}`)} title={d.question}
                desc={<div className="n-opts">{d.options.map(o => <span key={o} className="n-opt">{o}</span>)}</div>} />
            ))}</List> : <Empty>결정 대기 없음</Empty>}
          </Card>
        </Sec>
      </G2>

      <Sec title="어제 작업" count={work.length} link="브리핑 ↗" onLink={() => brief && setOpen(brief)}>
        <Card>
          {work.length ? <List>{work.map((w, i) => <Row key={i} left={<Kind>{w.kind}</Kind>} title={w.title} desc={w.detail} />)}</List> : <Empty>기록 없음</Empty>}
        </Card>
      </Sec>

      {open && <BriefingModal briefing={open} workspaceId={workspace.id} onClose={() => setOpen(null)} />}
    </>
  );
}
