/**
 * @file src/brand/views/ResearchView.tsx
 * @description 05 리서치 - 본부 매일 리서치(근거 · 판단 · 시사점 · 출처)와 직접 메모. 같은 규격 카드 갤러리
 * 주소: /w/:id/research/(new | <id>)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrandViewProps } from '../BrandShell';
import { Research, addContent, addResearchNote, addTask, fmtFull, listResearch } from '../hq.service';
import { Act, Badge, Empty, Err, Field, PageHead, Panel, Sec, Seg, Skeleton, Tabs } from '../ui';

const KINDS = ['인기 상품', '인기 콘텐츠', '트렌드', '표현', '아이디어'];
const host = (u?: string) => { try { return u ? new URL(u).hostname.replace(/^www\./, '') : ''; } catch { return ''; } };

export function ResearchView({ workspace, detailId, go }: BrandViewProps) {
  const ws = workspace.id;
  const [items, setItems] = useState<Research[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [tab, setTab] = useState('all');
  const load = useCallback(async () => { try { setItems(await listResearch(ws)); setErr(null); } catch (e) { setErr(e); } }, [ws]);
  useEffect(() => { load(); }, [load]);

  const list = items ?? [];
  const shown = list.filter(r => tab === 'all' || (tab === 'me' ? r.source === 'me' : r.kind === tab));
  const byDate = useMemo(() => {
    const m = new Map<string, Research[]>();
    shown.forEach(r => m.set(r.date, [...(m.get(r.date) ?? []), r]));
    return [...m];
  }, [shown]);
  const sel = list.find(r => r.id === detailId);

  return (
    <>
      <PageHead title="리서치" action={<Act onClick={() => go('research', 'new')}>+ 메모</Act>} />
      <Tabs value={tab} onChange={setTab} items={[
        { key: 'all', label: '전체', count: list.length },
        ...KINDS.map(k => ({ key: k, label: k, count: list.filter(r => r.kind === k).length })),
        { key: 'me', label: '내 메모', count: list.filter(r => r.source === 'me').length },
      ]} />
      {!!err && <Err e={err} />}
      {!items ? <Skeleton /> : !byDate.length ? <Empty>리서치 없음</Empty> : byDate.map(([d, rs]) => (
        <Sec key={d} title={fmtFull(d)} count={rs.length}>
          <div className="n-gal">{rs.map(r => (
            <div key={r.id} className="n-gc click" onClick={() => go('research', r.id)}>
              <div className="n-gm"><span className="n-kind">{r.kind}</span><span>{d.slice(5).replace('-', '.')}</span><Badge source={r.source} /></div>
              <h3>{r.title}</h3><p>{r.summary}</p><div className="grow" />
              <div className="n-gf"><span>근거 {r.evidence.length}</span><span>시사점 {r.implications.length}</span><span className="h">{host(r.link || r.sources[0]?.url) || (r.source === 'me' ? '직접' : '자체 제안')}</span></div>
            </div>
          ))}</div>
        </Sec>
      ))}

      {sel && (
        <Panel title={sel.kind} tag={sel.date.slice(5).replace('-', '.')} onClose={() => go('research')}
          foot={<><Act ghost onClick={async () => { await addTask(ws, { title: sel.title, why: `리서치 · ${sel.kind}` }); go('tasks'); }}>할 일로 추가</Act><span className="grow" />
            <Act onClick={async () => { await addContent(ws, { title: sel.title, stage: 'plan', memo: `리서치 ${sel.date} · ${sel.kind}` }); go('content'); }}>콘텐츠로 추가</Act></>}>
          <h3 className="n-ttl">{sel.title}</h3>
          {sel.summary && <div className="n-sub">{sel.summary}</div>}
          {sel.evidence.length > 0 && <Field label="근거"><div className="n-box"><ul>{sel.evidence.map((x, i) => <li key={i}>{x}</li>)}</ul></div></Field>}
          {sel.judgment && <Field label="판단"><div className="n-box">{sel.judgment}</div></Field>}
          {sel.implications.length > 0 && <Field label="시사점"><div className="n-box acc"><ul>{sel.implications.map((x, i) => <li key={i}>{x}</li>)}</ul></div></Field>}
          {(sel.link || sel.sources.length > 0) && <Field label="출처"><div style={{ display: 'grid', gap: 4, fontSize: 12 }}>
            {[...(sel.link ? [{ url: sel.link, title: '' }] : []), ...sel.sources].map((s, i) => <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)' }}>↗ {s.title || host(s.url)}</a>)}
          </div></Field>}
        </Panel>
      )}
      {detailId === 'new' && <NotePanel onClose={() => go('research')} onSave={async f => { await addResearchNote(ws, f); await load(); go('research'); }} />}
    </>
  );
}

function NotePanel({ onClose, onSave }: { onClose: () => void; onSave: (f: { kind: string; title: string; summary?: string; link?: string }) => Promise<void> }) {
  const [kind, setKind] = useState(KINDS[1]);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Panel title="메모 추가" onClose={onClose}
      foot={<><Act ghost onClick={onClose}>취소</Act><span className="grow" /><Act disabled={busy || !title.trim()} onClick={async () => { setBusy(true); try { await onSave({ kind, title, summary: summary.trim() || undefined, link: link.trim() || undefined }); } finally { setBusy(false); } }}>저장</Act></>}>
      <Field label="링크"><input className="n-in" value={link} onChange={e => setLink(e.target.value)} placeholder="URL 입력 (선택)" inputMode="url" /></Field>
      <Field label="구분"><Seg items={KINDS.map(k => ({ key: k, label: k }))} value={kind} onChange={setKind} /></Field>
      <Field label="제목"><input className="n-in" value={title} onChange={e => setTitle(e.target.value)} placeholder="한 줄 요약" autoFocus /></Field>
      <Field label="내용"><textarea className="n-in area" rows={4} value={summary} onChange={e => setSummary(e.target.value)} placeholder="본 것 · 생각" /></Field>
    </Panel>
  );
}
