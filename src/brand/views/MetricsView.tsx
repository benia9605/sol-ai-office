/**
 * @file src/brand/views/MetricsView.tsx
 * @description 06 실적 · 유입 - 본부가 매일 브랜드 DB 에서 읽어 보낸 숫자 그대로 (hq_metrics). 손으로 고치지 않는다
 *  없는 날은 「-」 (숫자를 지어내지 않는다). 유입 경로는 raw.sources 가 오면 표시
 * 주소: /w/:id/metrics/<YYYY-MM-DD>
 */
import { Fragment, useEffect, useState } from 'react';
import { BrandViewProps } from '../BrandShell';
import { Briefing, Metrics, MetricItem, fmtDay, listBriefings, listMetrics, todayKst } from '../hq.service';
import { Act, Card, Empty, Err, Field, G2, Kind, List, NoHit, PageHead, Pager, Panel, Row, Sec, Skeleton, hay, matchSearch, usePaged } from '../ui';
import { BriefingModal } from './BriefingView';

export function MetricsStrip({ items }: { items: MetricItem[] }) {
  return (
    <div className="simok-metrics n-metrics">
      {items.slice(0, 4).map(x => {
        const mm = String(x.value).match(/^([\d,.-]+)(.*)$/);
        return (
          <div key={x.label} className="simok-metric">
            <div className="simok-metric-label">{x.label}</div>
            <div className={`simok-metric-value${x.value === '-' ? ' unknown' : ''}`}>{mm ? <>{mm[1]}<span>{mm[2]}</span></> : x.value}</div>
            <div className="simok-metric-note">{x.note || ' '}</div>
          </div>
        );
      })}
    </div>
  );
}

const won = (n?: number | null) => (n == null ? '-' : n.toLocaleString('ko-KR'));
function Bars({ days, values, money }: { days: string[]; values: (number | null)[]; money?: boolean }) {
  const max = Math.max(1, ...values.map(v => v ?? 0));
  return (
    <>
      <div className="n-bars">{values.map((v, i) => (
        <div key={days[i]} className="n-bar">
          <b>{v == null ? '-' : money ? (v ? `${Math.round(v / 10000)}만` : '0') : v}</b>
          {v == null ? <i className="none" style={{ height: '14%' }} /> : <i style={{ height: `${Math.max(4, (v / max) * 80)}%` }} />}
        </div>
      ))}</div>
      <div className="n-barx">{days.map(d => <span key={d}>{d.slice(8)}</span>)}</div>
    </>
  );
}

export function MetricsView({ workspace, detailId, go }: BrandViewProps) {
  const [rows, setRows] = useState<Metrics[] | null>(null);
  const [briefs, setBriefs] = useState<Briefing[]>([]);
  const [open, setOpen] = useState<Briefing | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    Promise.all([listMetrics(workspace.id, 180), listBriefings(workspace.id, 40)]).then(([m, b]) => { setRows(m); setBriefs(b); }).catch(setErr);
  }, [workspace.id]);

  const list = rows ?? [];
  const latest = list[0];
  const days = Array.from({ length: 7 }, (_, i) => todayKst(i - 7));            // 어제까지 7일
  const pick = (k: string) => days.map(d => { const r = list.find(x => x.date === d); const v = r?.raw?.[k]; return typeof v === 'number' ? v : null; });
  const sel = list.find(r => r.date === detailId);
  // 일별 표 검색: 날짜(10.26 · 2026-10-26 · 월) · 채널 · 메모
  const rowsHit = list.filter(r => matchSearch(hay(r.date, fmtDay(r.date), Object.keys(r.raw.byChannel ?? {}), r.items.map(x => x.note)), q));
  const pg = usePaged(rowsHit);
  const sources: { name: string; count: number }[] = Array.isArray(latest?.raw?.sources) ? latest!.raw.sources : [];
  const workOf = (date: string) => { const b = briefs.find(x => x.meta?.day === date); return Array.isArray(b?.meta?.work) ? b!.meta.work : []; };

  return (
    <>
      <PageHead title="실적 · 유입" small="본부 · 매일 09:00 갱신" search={{ value: q, onChange: setQ, placeholder: '날짜 · 채널 검색' }} />
      {!!err && <Err e={err} />}
      {!rows ? <Skeleton /> : (
        <>
          <Sec title="어제 실적" count={latest ? fmtDay(latest.date) : ''}>
            {latest ? <MetricsStrip items={latest.items} /> : <Card><Empty>실적 기록 없음</Empty></Card>}
          </Sec>
          <G2>
            <Sec title="매출 추이" count="최근 7일"><Card pad><Bars days={days} values={pick('revenue')} money /></Card></Sec>
            <Sec title="방문 추이" count="최근 7일"><Card pad><Bars days={days} values={pick('visits')} /></Card></Sec>
          </G2>
          <Sec title="일별 실적" count="방문은 내부 접속 제외">
            <Card pad>{rowsHit.length ? (
              <table className="n-tbl">
                <thead><tr><th>날짜</th><th>매출</th><th>판매</th><th className="hide-m">채널</th><th>방문</th><th>가입</th></tr></thead>
                <tbody>{pg.shown.map(r => (
                  <tr key={r.date} onClick={() => go('metrics', r.date)} style={{ cursor: 'pointer' }}>
                    <td>{fmtDay(r.date, false)}</td><td className="num">{won(r.raw.revenue)}</td><td className="num">{r.raw.sales ?? r.raw.orders ?? '-'}</td>
                    <td className="hide-m">{Object.keys(r.raw.byChannel ?? {}).join(' · ') || '-'}</td><td className="num">{r.raw.visits ?? '-'}</td><td className="num">{r.raw.signups ?? '-'}</td>
                  </tr>
                ))}</tbody>
              </table>) : q ? <NoHit q={q} /> : <Empty>기록 없음</Empty>}</Card>
            <Pager {...pg} />
          </Sec>
          <Sec title="유입 경로">
            <Card>{sources.length ? <List>{sources.map(s => <Row key={s.name} title={s.name} right={<span className="n-b">{s.count}</span>} />)}</List>
              : <List><Row title="수집 전" desc="브랜드 사이트의 유입 기록이 시작되면 표시" /></List>}</Card>
          </Sec>
        </>
      )}
      {sel && (
        <Panel title={fmtDay(sel.date)} tag="자동" onClose={() => go('metrics')}
          foot={<><span className="grow" />{briefs.find(b => b.meta?.day === sel.date) && <Act onClick={() => setOpen(briefs.find(b => b.meta?.day === sel.date)!)}>브리핑 ↗</Act>}</>}>
          <dl className="n-kv">{sel.items.map(x => <Fragment key={x.label}><dt>{x.label}</dt><dd>{x.value}</dd></Fragment>)}</dl>
          {sel.raw.byChannel && <Field label="채널별 매출"><div className="n-box">{Object.entries(sel.raw.byChannel as Record<string, number>).map(([k, v]) => <div key={k}>{k} {won(v)}원</div>)}</div></Field>}
          {workOf(sel.date).length > 0 && <Field label="작업"><Card><List>{workOf(sel.date).map((w: any, i: number) => <Row key={i} left={<Kind>{w.kind}</Kind>} title={w.title} desc={w.detail} />)}</List></Card></Field>}
        </Panel>
      )}
      {open && <BriefingModal briefing={open} workspaceId={workspace.id} onClose={() => setOpen(null)} />}
    </>
  );
}
