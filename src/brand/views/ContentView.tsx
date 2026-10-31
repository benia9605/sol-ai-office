/**
 * @file src/brand/views/ContentView.tsx
 * @description 04 콘텐츠 - 종류 줄(캐러셀 · 영상 · 게시물) × 단계(기획 · 원고 · 촬영 · 편집 · 게시 완료) (2026-10-30 시안 B4 확정)
 *  - PC: 종류마다 줄 배경 · 빈 칸은 점선 · 카드를 끌어서 같은 줄 다른 단계에 놓는다 (HTML5 drag)
 *  - 폰: 위 종류 필터 + 왼쪽 세로선에 단계 점 · 카드를 눌러 「단계」 로 옮긴다
 *  - 진행 카드: 위 정사각 미리보기(장 그림이 있으면 · 캐러셀 「1 / n」) · 제목 · 채널 아이콘 + 자동/직접 뱃지 + 날짜 칩
 *  - 게시 완료: 최근 7일만 한 줄 카드 · 나머지는 「지난 게시 n ↗」 판
 *  - 캐러셀 카드는 본부가 확정한 것을 hq_carousel(074)로 넣는다: 장 그림 · 인스타 · 스레드 글
 *  - 다음 주 캐러셀 주제: 일요일 본부가 Top 10 후보(key topic:<월요일>:nn · 게시일 없음)를 넣는다 → 고르면 빈 날 게시일 → 그날 본부가 그 주제로 캐러셀 (074 hq_topics)
 *  - 원고 단계 카드는 본부가 매일 초안을 쓴다 (draft_status auto). 사람이 고치거나 확정하면 본부가 덮어쓰지 않는다
 * 주소: /w/:id/content/(new | done | <content id>)
 */
import { useCallback, useEffect, useState } from 'react';
import { BrandViewProps } from '../BrandShell';
import {
  Content, ContentFormat, FORMATS, Prompt, STAGES, Stage, addContent, addContentPhotos, deleteContent, fmtDay, getContentCover, getContentSlides,
  listContents, listPrompts, todayKst, updateContent,
} from '../hq.service';
import { Act, Card, DueSeg, Empty, Err, Field, Kind, List, Mini, PageHead, Panel, Row, Seg, Skeleton, Tabs, hay, matchSearch } from '../ui';
import { Site, SiteIcon } from './InsightsView';
import { CarouselPick, Lightbox, OrderSection, RequestSection, baseName } from './CarouselPick';

const CHANNELS = ['인스타', '스레드', '인스타 · 스레드', '유튜브', '블로그'];
const CH_SITE: Record<string, Site> = { 인스타: 'instagram', 피드: 'instagram', 릴스: 'instagram', 스레드: 'threads', 유튜브: 'youtube', 쇼츠: 'youtube', 블로그: 'naver' };
const fmtInfo = (k: ContentFormat) => FORMATS.find(f => f.key === k)!;

function ChIcons({ ch, size = 14 }: { ch?: string; size?: number }) {
  if (!ch) return null;
  const sites = [...new Set(ch.split(/\s*·\s*/).map(x => CH_SITE[x.trim()] ?? 'web'))];
  return <span className="n-chi" title={ch}>{sites.map(k => <SiteIcon key={k} site={k} size={size} />)}</span>;
}
const Who = ({ c }: { c: Content }) => <span className={`n-b ${c.source === 'hq' ? 'hq' : 'me'}`}>{c.source === 'hq' ? '자동' : '직접'}</span>;
function DDay({ due, today }: { due?: string; today: string }) {
  if (!due) return null;
  const n = Math.round((new Date(due).getTime() - new Date(today).getTime()) / 864e5);
  const [l, cls] = n < 0 ? [`${-n}일 지남`, 'late'] : n === 0 ? ['오늘', 'today'] : n === 1 ? ['내일', 'soon'] : [`D-${n}`, ''];
  return <span className={`n-dd ${cls}`}>{l}</span>;
}
/** 첫 장 그림 - 보이는 카드만 불러온다 */
function Cover({ c, square = true }: { c: Content; square?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!c.slideCount) { setSrc(null); return; }
    let u: string | null = null, live = true;
    getContentCover(c.id).then(x => { u = x; if (live) setSrc(x); });
    return () => { live = false; if (u) URL.revokeObjectURL(u); };
  }, [c.id, c.slideCount, c.updatedAt]);
  if (!c.slideCount) return null;
  return square
    ? <div className="cv">{src && <img src={src} alt="" />}{c.format === 'carousel' && c.slideCount > 1 ? <span>1 / {c.slideCount}</span> : c.format === 'video' ? <span>▶</span> : null}</div>
    : src ? <img src={src} alt="" /> : <span className="ic" />;
}
const recent = (c: Content, today: string) => (c.dueDate ?? c.updatedAt.slice(0, 10)) >= new Date(new Date(today).getTime() - 6 * 864e5).toISOString().slice(0, 10);

export function ContentView({ workspace, detailId, go }: BrandViewProps) {
  const ws = workspace.id;
  const [items, setItems] = useState<Content[] | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [tab, setTab] = useState<'now' | 'topics'>('now');
  const [fmtTab, setFmtTab] = useState<ContentFormat | 'all'>('all');
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const today = todayKst();

  const load = useCallback(async () => {
    try { const [c, p] = await Promise.all([listContents(ws), listPrompts(ws)]); setItems(c); setPrompts(p); setErr(null); } catch (e) { setErr(e); }
  }, [ws]);
  useEffect(() => { load(); }, [load]);

  const all = items ?? [];
  const isTopic = (c: Content) => !!c.hqKey?.startsWith('topic:') && c.stage === 'plan';
  const topics = all.filter(isTopic).sort((a, b) => (a.hqKey! < b.hqKey! ? -1 : 1));
  const list = all.filter(c => !(isTopic(c) && !c.dueDate)).filter(c => matchSearch(hay(c.title, c.channel, c.memo, c.draft, c.captionIg, c.captionThreads), q));
  const replace = (c: Content) => setItems(xs => (xs ?? []).map(x => (x.id === c.id ? c : x)));
  const move = async (id: string, stage: Stage) => {
    const c = all.find(x => x.id === id);
    if (!c || c.stage === stage) return;
    replace({ ...c, stage });                         // 바로 옮겨 보이고
    try { replace(await updateContent(id, { stage })); } catch (e) { setErr(e); replace(c); }
  };
  const sel = all.find(c => c.id === detailId);
  const byDue = (a: Content, b: Content) => ((a.dueDate ?? '9') < (b.dueDate ?? '9') ? -1 : 1);
  const cellOf = (f: ContentFormat, st: Stage) => list.filter(c => c.format === f && c.stage === st).sort(byDue);
  const doneShown = (f: ContentFormat) => cellOf(f, 'done').filter(c => recent(c, today)).sort((a, b) => (byDue(b, a)));
  const doneOld = (f: ContentFormat) => cellOf(f, 'done').length - doneShown(f).length;

  const card = (c: Content) => c.stage === 'done' ? (
    <div key={c.id} className="n-done click" onClick={() => go('content', c.id)}>
      {c.slideCount ? <Cover c={c} square={false} /> : <span className="ic" style={{ color: fmtInfo(c.format).color, background: fmtInfo(c.format).bg }}>{fmtInfo(c.format).icon}</span>}
      <div><b>{c.title}</b><small>{c.dueDate ? fmtDay(c.dueDate, false) : ''}<ChIcons ch={c.channel} size={12} /></small></div>
    </div>
  ) : (
    <div key={c.id} className={`n-k4 click${dragId === c.id ? ' n-dragging' : ''}`} draggable
      onDragStart={e => { setDragId(c.id); e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; }}
      onDragEnd={() => { setDragId(null); setOver(null); }}
      onClick={() => go('content', c.id)}>
      <Cover c={c} />
      <b>{c.title}</b>
      {c.stage === 'draft' && c.draftStatus && <div className="n-gm" style={{ marginTop: 6 }}><span className="n-b hq">{c.draftStatus === 'auto' ? `초안 v${c.draftVersion}` : c.draftStatus === 'edited' ? '원고 수정 중' : '원고 확정'}</span></div>}
      <div className="mt"><span className="l"><ChIcons ch={c.channel} /><Who c={c} />{c.pickStatus === 'done' && <span className="n-b ok">선택 완료</span>}</span><DDay due={c.dueDate} today={today} /></div>
    </div>
  );

  const fmts = fmtTab === 'all' ? FORMATS : FORMATS.filter(f => f.key === fmtTab);
  return (
    <>
      <PageHead title="콘텐츠" search={{ value: q, onChange: setQ, placeholder: '콘텐츠 검색' }} action={<Act onClick={() => go('content', 'new')}>+ 콘텐츠</Act>} />
      {!!err && <Err e={err} />}
      {!items ? <Skeleton /> : (
        <>
          <Tabs value={tab} onChange={setTab} items={[
            { key: 'now', label: '현황' },
            { key: 'topics', label: '다음 주 캐러셀 주제', count: topics.length ? Math.max(0, 7 - topics.filter(t => t.dueDate).length) : undefined },
          ]} />
          {tab === 'topics' ? (topics.length
            ? <Topics topics={topics} all={all} onChange={replace} onRemove={ids => setItems(xs => (xs ?? []).filter(x => !ids.includes(x.id)))} setErr={setErr} />
            : <Empty>후보 없음 · 매주 일요일 다음 주 주제 Top 10 등록</Empty>) : <>
          {/* PC - 종류 줄 × 단계 */}
          <div className="n-b3">
            <div className="n-b3-h"><span />{STAGES.map(s => (
              <b key={s.key}>{s.label}<em>{list.filter(c => c.stage === s.key && (s.key !== 'done' || recent(c, today))).length}</em>{s.key === 'done' && <small>최근 7일</small>}</b>
            ))}</div>
            {FORMATS.map(f => (
              <div key={f.key} className="n-b3-r">
                <div className="n-b3-t" style={{ color: f.color }}><i>{f.icon}</i><b>{f.label}</b><small>{f.sub}</small><em>{list.filter(c => c.format === f.key).length}</em></div>
                {STAGES.map(s => {
                  const cs = s.key === 'done' ? doneShown(f.key) : cellOf(f.key, s.key);
                  const key = `${f.key}:${s.key}`;
                  return (
                    <div key={s.key} className={`n-b3-c${cs.length ? '' : ' empty'}${s.key === 'done' ? ' done' : ''}${over === key ? ' over' : ''}`}
                      onDragOver={e => { e.preventDefault(); setOver(key); }} onDragLeave={() => setOver(o => (o === key ? null : o))}
                      onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); setOver(null); if (id) move(id, s.key); }}>
                      {cs.map(card)}
                      {s.key === 'done' && doneOld(f.key) > 0 && <a onClick={() => go('content', `done-${f.key}`)}>지난 게시 {doneOld(f.key)} ↗</a>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {/* 폰 - 종류 필터 + 단계 세로선 */}
          <div className="n-lanes-m">
            <div className="n-chips n-chips-row">
              <button type="button" className={fmtTab === 'all' ? 'on' : ''} onClick={() => setFmtTab('all')}>전체 {list.length}</button>
              {FORMATS.map(f => <button key={f.key} type="button" className={fmtTab === f.key ? 'on' : ''} onClick={() => setFmtTab(f.key)}>{f.icon} {f.label} {list.filter(c => c.format === f.key).length}</button>)}
            </div>
            <div className="n-tl">{STAGES.map(s => {
              const cs = fmts.flatMap(f => (s.key === 'done' ? doneShown(f.key) : cellOf(f.key, s.key)));
              const old = s.key === 'done' ? fmts.reduce((n, f) => n + doneOld(f.key), 0) : 0;
              return (
                <div key={s.key} className={`n-tl-s${cs.length ? '' : ' empty'}`}>
                  <div className="n-tl-h"><i /><b>{s.label}</b><span>{cs.length}</span></div>
                  {cs.map(card)}
                  {old > 0 && <a className="n-more" onClick={() => go('content', `done-${fmtTab === 'all' ? 'all' : fmtTab}`)}>최근 7일 · 지난 게시 {old} ↗</a>}
                </div>
              );
            })}</div>
          </div>
          </>}
        </>
      )}

      {detailId === 'new' && <ContentPanel ws={ws} title="콘텐츠 추가" onClose={() => go('content')}
        onSave={async f => { const c = await addContent(ws, { title: f.title, channel: f.channel, stage: f.stage, dueDate: f.dueDate, memo: f.memo, format: f.format }); setItems(xs => [...(xs ?? []), c]); go('content'); }} />}
      {detailId?.startsWith('done-') && <DonePanel items={all.filter(c => c.stage === 'done' && !recent(c, today))} initial={detailId.slice(5) as ContentFormat | 'all'} onOpen={id => go('content', id)} onClose={() => go('content')} />}
      {sel && <ContentPanel ws={ws} title={sel.format === 'carousel' && sel.slideCount ? `캐러셀 · ${sel.slideCount}장` : '콘텐츠'} c={sel} prompt={prompts.find(p => p.id === sel.promptId)} onClose={() => go('content')}
        onSave={async f => { replace(await updateContent(sel.id, f)); go('content'); }}
        onPhotos={n => replace({ ...sel, slideCount: n, updatedAt: new Date().toISOString() })}
        onPatch={p => replace({ ...sel, ...p })}
        onDelete={async () => { await deleteContent(sel.id); setItems(xs => (xs ?? []).filter(x => x.id !== sel.id)); go('content'); }}
        onOpenPrompt={() => go('library', sel.promptId)} />}
    </>
  );
}

/** 다음 주 캐러셀 주제 Top 10 - 고르면 그 주 빈 날 순서로 게시일 */
const WD = ['일', '월', '화', '수', '목', '금', '토'];
function Topics({ topics, all, onChange, onRemove, setErr }: { topics: Content[]; all: Content[]; onChange: (c: Content) => void; onRemove: (ids: string[]) => void; setErr: (e: unknown) => void }) {
  const monday = topics[0].hqKey!.split(':')[1] ?? todayKst();
  const days = Array.from({ length: 7 }, (_, i) => new Date(new Date(monday).getTime() + i * 864e5).toISOString().slice(0, 10));
  const used = new Set(all.filter(c => c.format === 'carousel' && c.dueDate && days.includes(c.dueDate)).map(c => c.dueDate!));
  const picked = topics.filter(t => t.dueDate).length;
  const set = async (t: Content, dueDate: string) => { try { onChange(await updateContent(t.id, { dueDate })); } catch (e) { setErr(e); } };
  const label = (d: string) => `${fmtDay(d, false)} ${WD[new Date(d).getDay()]}`;
  return (
    <section className="n-sec">
      <div className="n-sh"><h2>{label(days[0])} ~ {label(days[6])}</h2><span className="cnt">본부 Top {topics.length} · {picked} / 7 고름</span>
        <span className="lnk" style={{ cursor: 'pointer' }} onClick={async () => {
          const rest = topics.filter(t => !t.dueDate);
          if (!rest.length || !confirm(`고르지 않은 ${rest.length}개를 뺄까요?`)) return;
          try { await Promise.all(rest.map(t => deleteContent(t.id))); onRemove(rest.map(t => t.id)); } catch (e) { setErr(e); }
        }}>남은 것 빼기</span></div>
      <Card><ul className="n-list n-tps">{topics.map((t, i) => (
        <li key={t.id} className={`n-tp${t.dueDate ? ' on' : ''}`}>
          <span className="no">{i + 1}</span>
          <div className="m"><b>{t.title}</b>{t.memo && <small>{t.memo}</small>}</div>
          {t.dueDate ? <>
            <select className="n-dd soon" value={t.dueDate} onChange={e => set(t, e.target.value)}>{days.map(d => <option key={d} value={d}>{label(d)}</option>)}</select>
            <Mini onClick={() => set(t, '')}>빼기</Mini>
          </> : <Mini primary onClick={() => set(t, days.find(d => !used.has(d)) ?? days[6])}>고르기</Mini>}
        </li>
      ))}</ul></Card>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>고르면 빈 날 순서로 게시일이 잡히고 (날짜를 눌러 바꿈) 현황 탭 기획 줄에 캐러셀 카드로 · 그날 아침 본부가 그 주제로 캐러셀을 만든다 · 안 고른 날은 본부가 고른다 · 후보는 매주 일요일 9시에 바뀐다</div>
    </section>
  );
}

/** 지난 게시 - 종류 칩 · 달마다 · 정사각 썸네일 */
function DonePanel({ items, initial, onOpen, onClose }: { items: Content[]; initial: ContentFormat | 'all'; onOpen: (id: string) => void; onClose: () => void }) {
  const [f, setF] = useState<ContentFormat | 'all'>(initial);
  const shown = items.filter(c => f === 'all' || c.format === f).sort((a, b) => ((b.dueDate ?? b.updatedAt) > (a.dueDate ?? a.updatedAt) ? 1 : -1));
  const months = [...new Set(shown.map(c => (c.dueDate ?? c.updatedAt).slice(0, 7)))];
  return (
    <Panel title="게시 완료 · 지난 것" onClose={onClose} foot={<><span className="grow" /><Act ghost onClick={onClose}>닫기</Act></>}>
      <Seg items={[{ key: 'all' as const, label: `전체 ${items.length}` }, ...FORMATS.map(x => ({ key: x.key, label: `${x.icon} ${x.label} ${items.filter(c => c.format === x.key).length}` }))]} value={f} onChange={setF} />
      {months.map(m => (
        <Field key={m} label={`${m.replace('-', '.')} · ${shown.filter(c => (c.dueDate ?? c.updatedAt).startsWith(m)).length}`}>
          <div className="n-done-grid">{shown.filter(c => (c.dueDate ?? c.updatedAt).startsWith(m)).map(c => (
            <button key={c.id} type="button" onClick={() => onOpen(c.id)}>
              <div className="sq">{c.slideCount ? <Cover c={c} square={false} /> : <span className="ic" style={{ color: fmtInfo(c.format).color, background: fmtInfo(c.format).bg }}>{fmtInfo(c.format).icon}</span>}</div>
              <small>{c.dueDate ? fmtDay(c.dueDate, false) : ''} · {c.title}</small>
            </button>
          ))}</div>
        </Field>
      ))}
      {!shown.length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>지난 게시 없음</div>}
    </Panel>
  );
}

/** 장 그림 - 3 × 2 · 누르면 크게 · 모두 받기 */
function Slides({ c, ws, onPhotos }: { c: Content; ws: string; onPhotos: (n: number) => void }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [lb, setLb] = useState<number | null>(null);
  useEffect(() => {
    let us: string[] = [], live = true;
    if (c.slideCount) getContentSlides(c.id).then(x => { us = x; if (live) setUrls(x); }).catch(setErr);
    else setUrls([]);
    return () => { live = false; us.forEach(u => URL.revokeObjectURL(u)); };
  }, [c.id, c.slideCount]);
  const saveAll = () => urls.forEach((u, i) => { const a = document.createElement('a'); a.href = u; a.download = `${c.title.slice(0, 30)}-${String(i + 1).padStart(2, '0')}.jpg`; a.click(); });
  const add = async (fs: FileList | null) => {
    const files = [...(fs ?? [])].filter(x => x.type.startsWith('image/'));
    if (!files.length) return;
    setBusy(true); setErr(null);
    try { onPhotos(await addContentPhotos(ws, c.id, c.slideCount, files)); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <>
      {!!err && <Err e={err} />}
      {c.slideCount > 0 && <div className="n-slides">{(urls.length ? urls : Array.from({ length: c.slideCount }, () => '')).map((u, i) => (
        <a key={i} href={u || undefined} onClick={e => { e.preventDefault(); if (u) setLb(i); }}>{u && <img src={u} alt={`${i + 1}장`} />}<span>{i + 1}</span></a>
      ))}</div>}
      {lb != null && <Lightbox items={urls.map((u, i) => ({ url: u, label: `${i + 1}장`, file: `${baseName(c)}_${i + 1}장.jpg` }))} index={lb} onIndex={setLb} onClose={() => setLb(null)} />}
      <div className="n-slides-f">
        <span>{c.slideCount ? `${c.slideCount}장` : '사진 없음'}{c.format === 'carousel' && c.slideCount ? ' · 1080 × 1350' : ''}</span>
        <span className="grow" />
        {c.slideCount < 10 && c.source !== 'hq' && <label className="n-mini">{busy ? '올리는 중' : '+ 사진'}<input type="file" accept="image/*" multiple hidden onChange={e => { add(e.target.files); e.target.value = ''; }} /></label>}
        {urls.length > 0 && <Mini onClick={saveAll}>⬇ 사진 {urls.length}장 받기</Mini>}
      </div>
    </>
  );
}

function Captions({ c }: { c: Content }) {
  const [tab, setTab] = useState<'ig' | 'th'>('ig');
  const [copied, setCopied] = useState(false);
  const text = (tab === 'ig' ? c.captionIg : c.captionThreads) ?? '';
  return (
    <Field label="올릴 글">
      <Seg items={[{ key: 'ig' as const, label: '인스타' }, { key: 'th' as const, label: '스레드' }]} value={tab} onChange={k => { setTab(k); setCopied(false); }} />
      <div className="n-draft" style={{ marginTop: 8 }}>
        <div className="db">{text || '없음'}</div>
        <div className="df"><Mini onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); }}>{copied ? '복사됨' : '복사'}</Mini><span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>{text.length}자</span></div>
      </div>
    </Field>
  );
}

interface CForm { title: string; channel?: string; stage: Stage; dueDate?: string; memo?: string; draft?: string; draftStatus?: Content['draftStatus']; format: ContentFormat }
function ContentPanel({ ws, title, c, prompt, onClose, onSave, onDelete, onOpenPrompt, onPhotos, onPatch }: {
  ws: string; title: string; c?: Content; prompt?: Prompt; onClose: () => void; onSave: (f: CForm) => Promise<void>; onDelete?: () => Promise<void>; onOpenPrompt?: () => void; onPhotos?: (n: number) => void; onPatch?: (p: Partial<Content>) => void;
}) {
  const [f, setF] = useState<CForm>(() => ({ title: c?.title ?? '', channel: c?.channel, stage: c?.stage ?? 'plan', dueDate: c?.dueDate, memo: c?.memo ?? '', draft: c?.draft, draftStatus: c?.draftStatus, format: c?.format ?? 'post' }));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = todayKst();
  const save = async (patch: Partial<CForm> = {}) => { setBusy(true); try { await onSave({ ...f, ...patch }); } finally { setBusy(false); } };
  const hasDraft = !!c?.draft || f.stage === 'draft';
  return (
    <Panel title={title} tag={c?.source === 'hq' ? '자동' : undefined} onClose={onClose}
      foot={<>{onDelete && <Act ghost onClick={onDelete} disabled={busy}>삭제</Act>}<span className="grow" /><Act onClick={() => save()} disabled={busy || !f.title.trim()}>{c ? '저장' : '추가'}</Act></>}>
      {c && <h3 className="n-ttl">{c.title}</h3>}
      {/* 캐러셀 사진 고르기 (080) - 3안이 있고 확정본 전이면 고르기 · 아니면 장 그림 */}
      {c && c.format === 'carousel' && c.pickStatus && c.pickStatus !== 'none' && c.pickStatus !== 'made'
        ? <CarouselPick c={c} ws={ws} onChanged={p => onPatch?.(p)} />
        : c && <Slides c={c} ws={ws} onPhotos={n => onPhotos?.(n)} />}
      {c && (c.captionIg || c.captionThreads) && <Captions c={c} />}
      {c && c.format === 'carousel' && <OrderSection c={c} ws={ws} slideCount={c.slideCount} />}
      <Field label="단계"><Seg items={STAGES.map(s => ({ key: s.key, label: s.label }))} value={f.stage} onChange={k => setF({ ...f, stage: k })} /></Field>
      <Field label="종류"><Seg items={FORMATS.map(x => ({ key: x.key, label: `${x.icon} ${x.label}` }))} value={f.format} onChange={k => setF({ ...f, format: k })} /></Field>
      <Field label="제목"><input className="n-in" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="제목 입력" autoFocus={!c} /></Field>
      <Field label="채널"><Seg items={(f.channel && !CHANNELS.includes(f.channel) ? [f.channel, ...CHANNELS] : CHANNELS).map(x => ({ key: x, label: x }))} value={f.channel} onChange={k => setF({ ...f, channel: k })} /></Field>
      <Field label="게시일"><DueSeg value={f.dueDate} onChange={d => setF({ ...f, dueDate: d })} today={today} tomorrow={todayKst(1)} /></Field>
      {c && hasDraft && (
        <Field label="원고">
          <div className="n-draft">
            <div className="dh">{c.draft ? (f.draftStatus === 'auto' ? `초안 v${c.draftVersion}` : f.draftStatus === 'confirmed' ? '확정 원고' : '수정 중') : '초안 대기'}{f.draftStatus === 'auto' && <span className="n-b hq">자동</span>}</div>
            {editing
              ? <textarea className="n-in area" style={{ border: 0, borderRadius: 0, minHeight: 160 }} value={f.draft ?? ''} onChange={e => setF({ ...f, draft: e.target.value })} />
              : <div className="db">{c.draft || '원고 단계에 두면 다음 아침 본부가 초안을 씁니다'}</div>}
            <div className="df">
              {editing
                ? <Mini primary onClick={() => { setEditing(false); setF({ ...f, draftStatus: 'edited' }); }}>수정 끝</Mini>
                : <Mini onClick={() => setEditing(true)}>직접 수정</Mini>}
              {f.draftStatus !== 'auto' && c.draft && <Mini onClick={() => save({ draftStatus: 'auto' })}>다시 쓰기 요청</Mini>}
              {c.draft && f.draftStatus !== 'confirmed' && <Mini primary onClick={() => save({ draftStatus: 'confirmed', stage: f.stage === 'draft' ? 'shoot' : f.stage })}>원고 확정</Mini>}
            </div>
          </div>
        </Field>
      )}
      {prompt && <Field label="사용한 프롬프트"><Card><List><Row left={<Kind>v{prompt.version}</Kind>} title={prompt.title} desc="07 자료실" right={<Mini onClick={onOpenPrompt}>열기</Mini>} /></List></Card></Field>}
      <Field label={c?.source === 'hq' ? '본부 메모' : '메모'}><textarea className="n-in area" rows={3} value={f.memo} onChange={e => setF({ ...f, memo: e.target.value })} placeholder="선택 입력" /></Field>
      {c && c.format === 'carousel' && <RequestSection c={c} ws={ws} slideCount={c.slideCount} />}
    </Panel>
  );
}
