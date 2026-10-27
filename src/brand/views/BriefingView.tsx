/**
 * @file src/brand/views/BriefingView.tsx
 * @description 02 브리핑 - 날짜별 아침 브리핑. PC 는 왼쪽 큰 날짜(원래 디자인), 폰은 날짜 · 뱃지 · 열기 한 줄
 * 누르면 가운데 팝업(폰은 아래에서 전체)으로 본부 브리핑 HTML 을 그대로.
 *
 * ★ 보안: 브리핑 HTML 은 sandbox iframe(allow-scripts allow-popups) 으로만 그린다.
 *   allow-same-origin 을 주지 않는다 - 주면 브리핑 안 스크립트가 이 앱의 로그인 토큰에 닿는다 (rawHtml.ts 와 같은 원칙).
 *   iframe 이 판 높이를 다 쓰고 브리핑 안에서만 스크롤된다 (브리핑 위 메뉴 줄은 브리핑 자체에서 고정).
 */
import { RefObject, useEffect, useRef, useState } from 'react';
import { BrandViewProps } from '../BrandShell';
import { Briefing, briefingState, fmtDay, getBriefingHtml, listBriefings, addBriefingComment, deleteHqComment, pickDecisionByQuestion, setTaskDoneByTitle, todayKst } from '../hq.service';
import { Empty, Err, PageHead, Sec, Skeleton, Tabs, useEsc, useLockScroll } from '../ui';

/**
 * 브리핑 안 체크 · 결정 · 의견 · 메모 → 오피스 (postMessage).
 *   iframe → { hq: 'act', id, act: { op: state|task|decide|opinion|memo, ... } }
 *   이 판 → { hq: 'res', id, result | error }   (본부 보고서가 hq_act 로 받는 것과 같은 모양)
 * 이 iframe 이 보낸 것만 받고 (e.source), 이 워크스페이스 · 이 브리핑 안에서만 바꾼다. 토큰은 iframe 에 가지 않는다.
 */
function useBriefingSync(ws: string, briefingId: string, frame: RefObject<HTMLIFrameElement>) {
  useEffect(() => {
    const str = (v: unknown, max = 300) => (typeof v === 'string' && v.length <= max ? v : null);
    const strs = (v: unknown) => (Array.isArray(v) ? v.map(x => str(x)).filter((x): x is string => !!x) : []);
    const run = async (a: Record<string, unknown>) => {
      switch (a.op) {
        case 'state': return briefingState(ws, briefingId, strs(a.titles), strs(a.questions));
        case 'task': return { ok: !!str(a.title) && await setTaskDoneByTitle(ws, str(a.title)!, a.done === true) };
        case 'decide': return { ok: !!str(a.question) && await pickDecisionByQuestion(ws, str(a.question)!, a.picked === null ? null : str(a.picked)) };
        // 댓글 - 결정(question) 또는 브리핑 칸(slot). memo · opinion 은 예전 브리핑용 같은 뜻
        case 'comment': case 'memo': case 'opinion': {
          const c = await addBriefingComment(ws, briefingId, a.op === 'opinion' || a.target === 'decision' ? { question: str(a.question) ?? '' } : { slot: str(a.slot) ?? '' }, str(a.text, 5000) ?? '');
          return c ? { ok: true, ...c } : { ok: false };
        }
        case 'uncomment': return { ok: !!str(a.id) && await deleteHqComment(str(a.id)!) };
        default: return { ok: false, why: 'unknown op' };
      }
    };
    const on = async (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const m = e.data as { hq?: string; id?: number; act?: Record<string, unknown> } | null;
      if (!m || m.hq !== 'act' || typeof m.id !== 'number' || !m.act || typeof m.act !== 'object') return;
      const reply = (body: Record<string, unknown>) => frame.current?.contentWindow?.postMessage({ hq: 'res', id: m.id, ...body }, '*');
      try { reply({ result: await run(m.act) }); }
      catch (err) { console.error('[briefing sync]', err); reply({ error: '저장 안 됨' }); }
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [ws, briefingId, frame]);
}

export function BriefingModal({ briefing, workspaceId, onClose }: { briefing: Briefing; workspaceId: string; onClose: () => void }) {
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  useLockScroll();
  useEsc(onClose);
  useBriefingSync(workspaceId, briefing.id, frame);
  useEffect(() => { getBriefingHtml(briefing.id).then(setHtml).catch(setErr); }, [briefing.id]);
  return (
    <>
      <div className="n-dim" onClick={onClose} />
      <div className="n-modal" role="dialog" aria-modal="true" aria-label="아침 브리핑">
        <div className="n-ph"><span className="n-b hq">{fmtDay(briefing.date, false)}</span><b>{briefing.source === 'hq' ? '아침 브리핑' : briefing.title}</b><button type="button" className="x" aria-label="닫기" onClick={onClose}>✕</button></div>
        {err ? <div style={{ padding: 20 }}><Err e={err} /></div>
          : html === null ? <div style={{ padding: 20 }}><Skeleton /></div>
          : html ? <iframe ref={frame} title="브리핑" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" srcDoc={html} />
          : <div style={{ padding: 20 }}><Empty>본문 없음</Empty></div>}
      </div>
    </>
  );
}

type Filter = 'all' | 'hq' | 'me';

export function BriefingView({ workspace, detailId, go }: BrandViewProps) {
  const [items, setItems] = useState<Briefing[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [filter, setFilter] = useState<Filter>('all');
  useEffect(() => { listBriefings(workspace.id).then(setItems).catch(setErr); }, [workspace.id]);

  const open = items?.find(b => b.id === detailId) ?? null;
  const today = todayKst();
  const shown = (items ?? []).filter(b => filter === 'all' || b.source === filter);
  const months = new Map<string, Briefing[]>();
  shown.forEach(b => { const k = `${b.date.slice(0, 4)}년 ${+b.date.slice(5, 7)}월`; months.set(k, [...(months.get(k) ?? []), b]); });

  return (
    <>
      <PageHead title="브리핑" />
      <Tabs value={filter} onChange={setFilter} items={[
        { key: 'all', label: '전체', count: items?.length },
        { key: 'hq', label: '아침 브리핑', count: items?.filter(b => b.source === 'hq').length },
        { key: 'me', label: '직접 작성', count: items?.filter(b => b.source === 'me').length },
      ]} />
      {!!err && <Err e={err} />}
      {!items ? <Skeleton /> : !shown.length ? <Empty>브리핑 없음</Empty> : [...months].map(([m, list]) => (
        <Sec key={m} title={m} count={list.length}>
          <div className="simok-report-list">
            {list.map(b => {
              const meta = b.meta ?? {};
              const w = fmtDay(b.date).slice(-2, -1);
              const tag = b.source === 'me' ? '직접 작성' : b.date === today ? '오늘' : '브리핑';
              return (
                <button key={b.id} type="button" className="simok-report-row n-rr" onClick={() => go('briefing', b.id)}>
                  <div className="simok-report-date"><div className="day">{b.date.slice(8)}</div><div className="month">{monthEn(b.date)} · {w}</div></div>
                  <div className="rc">
                    <div className="mtop"><b className="dm">{fmtDay(b.date, false)}</b><span className="wm">{w}</span><span className={`n-b${tag === '오늘' ? ' hq' : ''}`}>{tag}</span><span className="om">열기 ↗</span></div>
                    <h3>{b.summary || b.title}</h3>
                    <p>{meta.todo_count != null ? `할 일 ${meta.todo_count} · 결정 대기 ${meta.decision_count ?? 0}` : ''}</p>
                  </div>
                  <span className="simok-btn text op">열기 ↗</span>
                </button>
              );
            })}
          </div>
        </Sec>
      ))}
      {open && <BriefingModal briefing={open} workspaceId={workspace.id} onClose={() => go('briefing')} />}
    </>
  );
}

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const monthEn = (iso: string) => MON[+iso.slice(5, 7) - 1];
