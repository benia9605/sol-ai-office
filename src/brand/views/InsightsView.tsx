/**
 * @file src/brand/views/InsightsView.tsx
 * @description 06 인사이트 - 폰 단축어로 툭 던진 링크 · 캡처 · 메모 (마이그 073)
 *   종류 셋 (2026-10-30 대표): AI · 프롬프트 / 레퍼런스 참고 / 인사이트 정보 · 브랜드: 공통 · 시목 · 쏠닝오즈 · 운명랩
 *   본부(sol-hq)가 매일 아침 읽고 「본부 정리」 를 남긴다 (공통/배움 · 보고서 「오늘 배운 것」)
 *   링크 어디냐에 따라 아이콘 · 유튜브는 앱 안 재생 · 인스타 · 스레드는 공개 게시물 임베드 · + 던지기에 사진 직접 (2026-10-30 시안 확정)
 * 주소: /w/:id/insights/(new | <id>)
 */
import { useCallback, useEffect, useState } from 'react';
import { BrandViewProps } from '../BrandShell';
import {
  INSIGHT_BRANDS, INSIGHT_KINDS, Insight, InsightBrand, InsightKind, addContent, addInsight, addTask, deleteInsight,
  fmtFull, getInsightFirstImage, getInsightImages, listInsights, setInsightStatus,
} from '../hq.service';
import { Act, Empty, Err, Field, NoHit, PageHead, Pager, Panel, Sec, Seg, Skeleton, Tabs, hay, matchSearch, usePaged } from '../ui';

const host = (u?: string) => { try { return u ? new URL(u).hostname.replace(/^www\./, '') : ''; } catch { return ''; } };
const kindLabel = (k: InsightKind) => INSIGHT_KINDS.find(x => x.key === k)?.label ?? k;
const brandLabel = (b: InsightBrand) => INSIGHT_BRANDS.find(x => x.key === b)?.label ?? b;
// 링크 어디 것인지 - 아이콘 · 미리보기 · 임베드
type Site = 'youtube' | 'instagram' | 'threads' | 'daangn' | 'naver' | 'web';
const siteOf = (u?: string): Site | null => {
  const h = host(u);
  if (!h) return null;
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(h)) return 'youtube';
  if (/(^|\.)instagram\.com$/.test(h)) return 'instagram';
  if (/(^|\.)threads\.(net|com)$/.test(h)) return 'threads';
  if (/(^|\.)(daangn\.com|karrotmarket\.com)$/.test(h)) return 'daangn';
  if (/(^|\.)naver\.(com|me)$/.test(h)) return 'naver';
  return 'web';
};
const youtubeId = (u?: string) => {
  if (!u) return null;
  try {
    const x = new URL(u);
    if (x.hostname.endsWith('youtu.be')) return x.pathname.slice(1).split('/')[0] || null;
    if (x.searchParams.get('v')) return x.searchParams.get('v');
    const m = x.pathname.match(/\/(shorts|embed|live)\/([\w-]{6,})/);
    return m ? m[2] : null;
  } catch { return null; }
};
const embedUrl = (u?: string): string | null => {
  const site = siteOf(u);
  if (site === 'youtube') { const id = youtubeId(u); return id ? `https://www.youtube-nocookie.com/embed/${id}` : null; }
  try {
    const x = new URL(u!);
    if (site === 'instagram') { const m = x.pathname.match(/^\/(p|reel|tv)\/([\w-]+)/); return m ? `https://www.instagram.com/${m[1]}/${m[2]}/embed/captioned/` : null; }
    if (site === 'threads') { const m = x.pathname.match(/^\/(@[\w.]+)\/post\/([\w-]+)/); return m ? `https://www.threads.com/${m[1]}/post/${m[2]}/embed` : null; }
  } catch { /* 주소가 아니면 임베드 없음 */ }
  return null;
};
function SiteIcon({ site }: { site: Site | null }) {
  const s = { width: 15, height: 15, flex: 'none' as const, verticalAlign: '-3px' };
  switch (site) {
    case 'youtube': return <svg viewBox="0 0 16 16" style={s} aria-label="유튜브"><rect y="2.5" width="16" height="11" rx="3.2" fill="#FF0000" /><path d="M6.4 5.4v5.2L10.8 8z" fill="#fff" /></svg>;
    case 'instagram': return <svg viewBox="0 0 16 16" style={s} aria-label="인스타그램" fill="none" stroke="#DD2A7B" strokeWidth="1.8"><rect x="1" y="1" width="14" height="14" rx="4" /><circle cx="8" cy="8" r="3.1" /><circle cx="12" cy="4" r=".6" fill="#DD2A7B" /></svg>;
    case 'threads': return <svg viewBox="0 0 16 16" style={s} aria-label="스레드"><rect width="16" height="16" rx="4" fill="#111" /><text x="8" y="11.6" fontSize="11" fontWeight="700" textAnchor="middle" fill="#fff" fontFamily="Arial">@</text></svg>;
    case 'daangn': return <svg viewBox="0 0 16 16" style={s} aria-label="당근"><path d="M8 15c-2.6 0-4.4-2.2-4.4-5S5.6 4.6 8 4.6s4.4 2.6 4.4 5.4S10.6 15 8 15z" fill="#FF6F0F" /><path d="M8 5c-.2-1.6.4-3 1.8-4 .3 1.5-.3 3-1.8 4z" fill="#3BB54A" /></svg>;
    case 'naver': return <svg viewBox="0 0 16 16" style={s} aria-label="네이버"><rect width="16" height="16" rx="3.5" fill="#03C75A" /><path d="M4.5 4h2.4l2.6 3.9V4h2v8H9.1L6.5 8.1V12h-2z" fill="#fff" /></svg>;
    case 'web': return <svg viewBox="0 0 16 16" style={s} aria-label="웹" fill="none" stroke="#7a7f76" strokeWidth="1.3"><circle cx="8" cy="8" r="6.4" /><path d="M1.6 8h12.8M8 1.6c2 2 2 10.8 0 12.8M8 1.6c-2 2-2 10.8 0 12.8" /></svg>;
    default: return null;
  }
}
const PlayMark = ({ big }: { big?: boolean }) => (
  <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: big ? 68 : 40, height: big ? 48 : 28, borderRadius: big ? 12 : 8, background: '#FF0000', display: 'grid', placeContent: 'center', pointerEvents: 'none' }}>
    <svg viewBox="0 0 10 12" width={big ? 18 : 11}><path d="M0 0v12l10-6z" fill="#fff" /></svg>
  </span>
);
/** 카드 위 미리보기 - 유튜브는 썸네일 16:9 · 그 밖은 첫 캡처 */
function CardThumb({ it }: { it: Insight }) {
  const yt = siteOf(it.url) === 'youtube' ? youtubeId(it.url) : null;
  const [src, setSrc] = useState<string | null>(yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null);
  useEffect(() => {
    if (yt || !it.imageCount) return;
    let u: string | null = null, live = true;
    getInsightFirstImage(it.id).then(x => { u = x; if (live) setSrc(x); });
    return () => { live = false; if (u) URL.revokeObjectURL(u); };
  }, [it.id, it.imageCount, yt]);
  if (!src) return null;
  return (
    <div style={{ position: 'relative', margin: '-16px -18px 12px', height: 0, paddingBottom: '56.25%', overflow: 'hidden', borderRadius: '13px 13px 0 0', background: '#eceae2' }}>
      <img src={src} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      {yt && <PlayMark />}
    </div>
  );
}
const headline = (i: Insight) => i.title || i.memo || i.body?.split('\n')[0] || host(i.url) || '캡처';

export function InsightsView({ workspace, detailId, go }: BrandViewProps) {
  const ws = workspace.id;
  const [items, setItems] = useState<Insight[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [tab, setTab] = useState<string>('all');
  const [q, setQ] = useState('');
  const load = useCallback(async () => { try { setItems(await listInsights(ws)); setErr(null); } catch (e) { setErr(e); } }, [ws]);
  useEffect(() => { load(); }, [load]);

  const list = items ?? [];
  const shown = list.filter(i => (tab === 'all' || (tab === 'new' ? i.status === 'new' : i.kind === tab))
    && matchSearch(hay(i.title, i.memo, i.body, i.url, i.hqNote, kindLabel(i.kind), brandLabel(i.brand)), q));
  const pg = usePaged(shown, 12);
  const byDate = (() => {
    const m = new Map<string, Insight[]>();
    pg.shown.forEach(i => { const d = new Date(new Date(i.createdAt).getTime() + 9 * 3600e3).toISOString().slice(0, 10); m.set(d, [...(m.get(d) ?? []), i]); });
    return [...m];
  })();
  const sel = list.find(i => i.id === detailId);

  return (
    <>
      <PageHead title="인사이트" search={{ value: q, onChange: setQ, placeholder: '인사이트 검색' }} action={<Act onClick={() => go('insights', 'new')}>+ 던지기</Act>} />
      <Tabs value={tab} onChange={setTab} items={[
        { key: 'all', label: '전체', count: list.length },
        { key: 'new', label: '새것', count: list.filter(i => i.status === 'new').length },
        ...INSIGHT_KINDS.map(k => ({ key: k.key, label: k.label, count: list.filter(i => i.kind === k.key).length })),
      ]} />
      {!!err && <Err e={err} />}
      {!items ? <Skeleton /> : !byDate.length ? (q ? <NoHit q={q} /> : <Empty>아직 없음 · 폰 공유 버튼 → 「인사이트」 단축어 · 또는 「+ 던지기」</Empty>) : byDate.map(([d, is]) => (
        <Sec key={d} title={fmtFull(d)} count={is.length}>
          <div className="n-gal">{is.map(i => (
            <div key={i.id} className={`n-gc click${i.status === 'new' ? ' on' : ''}`} onClick={() => go('insights', i.id)}>
              <CardThumb it={i} />
              <div className="n-gm"><span className="n-kind">{kindLabel(i.kind)}</span><span>{brandLabel(i.brand)}</span>{i.status === 'new' && <span style={{ color: 'var(--green)', fontWeight: 600 }}>새것</span>}</div>
              <h3>{headline(i)}</h3><p>{i.hqNote || i.body || i.url}</p><div className="grow" />
              <div className="n-gf"><span>{i.imageCount ? `캡처 ${i.imageCount}` : '캡처 없음'}</span><span className="h" style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><SiteIcon site={siteOf(i.url)} />{host(i.url) || (i.source === 'me' ? '직접' : '단축어')}</span></div>
            </div>
          ))}</div>
        </Sec>
      ))}
      <Pager {...pg} />

      {sel && <DetailPanel ws={ws} it={sel} go={go} reload={load} />}
      {detailId === 'new' && <NewPanel onClose={() => go('insights')} onSave={async f => { await addInsight(ws, f); await load(); go('insights'); }} />}
    </>
  );
}

function DetailPanel({ ws, it, go, reload }: { ws: string; it: Insight; go: BrandViewProps['go']; reload: () => Promise<void> }) {
  const [imgs, setImgs] = useState<string[]>([]);
  useEffect(() => {
    let urls: string[] = [];
    if (it.imageCount) getInsightImages(it.id).then(u => { urls = u; setImgs(u); }).catch(() => setImgs([]));
    if (it.status === 'new') setInsightStatus(it.id, 'read').then(reload).catch(() => {});
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [it.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const title = headline(it);
  const site = siteOf(it.url);
  const embed = embedUrl(it.url);
  return (
    <Panel title={kindLabel(it.kind)} tag={brandLabel(it.brand)} onClose={() => go('insights')}
      foot={<>
        <Act ghost onClick={async () => { if (confirm('이 인사이트를 지울까요?')) { await deleteInsight(it.id); await reload(); go('insights'); } }}>지우기</Act>
        <span className="grow" />
        <Act ghost onClick={async () => { await addTask(ws, { title, why: `인사이트 · ${kindLabel(it.kind)}` }); go('tasks'); }}>할 일로</Act>
        <Act onClick={async () => { await addContent(ws, { title, stage: 'plan', memo: `인사이트 · ${it.url ?? ''}` }); go('content'); }}>콘텐츠로</Act>
      </>}>
      {embed && site === 'youtube' && (
        <div style={{ position: 'relative', height: 0, paddingBottom: '56.25%', borderRadius: 10, overflow: 'hidden', background: '#000' }}>
          <iframe src={embed} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
        </div>
      )}
      <h3 className="n-ttl">{title}</h3>
      {it.memo && it.memo !== title && <Field label="내 메모"><div className="n-box">{it.memo}</div></Field>}
      {it.hqNote && <Field label="본부 정리"><div className="n-box acc" style={{ whiteSpace: 'pre-wrap' }}>{it.hqNote}</div></Field>}
      {it.url && <Field label="링크"><a href={it.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)', fontSize: 12, wordBreak: 'break-all', display: 'inline-flex', gap: 6, alignItems: 'flex-start' }}><SiteIcon site={site} /><span>{it.url} ↗</span></a></Field>}
      {embed && site !== 'youtube' && <Field label="게시물">
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
          <iframe src={embed} title="게시물" loading="lazy" style={{ display: 'block', width: '100%', height: site === 'instagram' ? 620 : 520, border: 0 }} />
        </div>
      </Field>}
      {it.body && <Field label="공유된 글"><div className="n-box" style={{ whiteSpace: 'pre-wrap' }}>{it.body}</div></Field>}
      {it.imageCount > 0 && <Field label={`캡처 ${it.imageCount}`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
          {imgs.length ? imgs.map((u, i) => <a key={i} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt={`캡처 ${i + 1}`} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--line)' }} /></a>) : <Skeleton />}
        </div>
      </Field>}
    </Panel>
  );
}

function NewPanel({ onClose, onSave }: { onClose: () => void; onSave: (f: { brand: InsightBrand; kind: InsightKind; url?: string; memo?: string; photos?: File[] }) => Promise<void> }) {
  const [kind, setKind] = useState<InsightKind>('info');
  const [brand, setBrand] = useState<InsightBrand>('common');
  const [url, setUrl] = useState('');
  const [memo, setMemo] = useState('');
  const [photos, setPhotos] = useState<{ file: File; src: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const addFiles = (fs: FileList | File[] | null) => {
    const imgs = [...(fs ?? [])].filter(f => f.type.startsWith('image/'));
    setPhotos(p => [...p, ...imgs.map(file => ({ file, src: URL.createObjectURL(file) }))].slice(0, 10));
  };
  useEffect(() => () => photos.forEach(p => URL.revokeObjectURL(p.src)), []); // eslint-disable-line react-hooks/exhaustive-deps
  // PC - 캡처를 ⌘V 로 붙여 넣기
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => { const fs = [...(e.clipboardData?.files ?? [])]; if (fs.length) { e.preventDefault(); addFiles(fs); } };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);
  const can = !busy && (!!url.trim() || !!memo.trim() || photos.length > 0);
  return (
    <Panel title="+ 던지기" onClose={onClose}
      foot={<><Act ghost onClick={onClose}>취소</Act><span className="grow" /><Act disabled={!can} onClick={async () => {
        setBusy(true); setErr(null);
        try { await onSave({ brand, kind, url: url.trim() || undefined, memo: memo.trim() || undefined, photos: photos.map(p => p.file) }); }
        catch (e) { setErr(e); } finally { setBusy(false); }
      }}>{busy ? '저장 중' : '저장'}</Act></>}>
      {!!err && <Err e={err} />}
      <Field label="링크"><input className="n-in" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://… (없으면 비워 두기)" inputMode="url" /></Field>
      <Field label={`사진 ${photos.length} / 10`}>
        <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {photos.map((p, i) => (
            <div key={p.src} style={{ position: 'relative', height: 0, paddingBottom: '100%' }}>
              <img src={p.src} alt={`사진 ${i + 1}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />
              <button type="button" aria-label="빼기" onClick={() => { URL.revokeObjectURL(p.src); setPhotos(ps => ps.filter(x => x !== p)); }}
                style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 11, display: 'grid', placeContent: 'center' }}>✕</button>
            </div>
          ))}
          {photos.length < 10 && (
            <label style={{ position: 'relative', height: 0, paddingBottom: '100%', border: '1.5px dashed #c9ccbf', borderRadius: 8, background: '#fbfaf5', cursor: 'pointer' }}>
              <span style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center', fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}><b style={{ fontSize: 18, color: 'var(--ink)', fontWeight: 400 }}>+</b>사진</span>
              <input type="file" accept="image/*" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
            </label>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>폰 = 찍기 · 앨범 · PC = 끌어 놓기 · 붙여 넣기 (캡처 ⌘V) · 장당 3MB 로 줄여서 저장</div>
      </Field>
      <Field label="종류"><Seg items={INSIGHT_KINDS} value={kind} onChange={setKind} /></Field>
      <Field label="브랜드"><Seg items={INSIGHT_BRANDS} value={brand} onChange={setBrand} /></Field>
      <Field label="한 줄 메모"><textarea className="n-in area" rows={3} value={memo} onChange={e => setMemo(e.target.value)} placeholder="왜 저장했는지 · 무엇이 좋았는지" /></Field>
    </Panel>
  );
}
