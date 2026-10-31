/**
 * @file src/brand/views/CarouselPick.tsx
 * @description 04 콘텐츠 캐러셀 판 - 사진 고르기 · 이미지 주문서 · 수정 요청 (마이그 080 · 시안 4판 2026-10-31 대표 확정)
 *  - 사진 고르기: 장마다 1안 · 2안 · 3안 · 누르면 가운데 팝업(크게 보기 · 이 안으로 선택) · 다 고르면 「선택 완료」 → 본부가 확정본 제작
 *  - 확대 보기(Lightbox): 가로로 넘김(PC 화살표 · 폰 스와이프) · 오른쪽 위 선택 / 선택됨 ✓ · 폰은 아래로 쓸어 닫기
 *  - 이미지 주문서: 주문마다 회색 박스(GPT 에 붙여 넣을 글) + 복사 · 「사진 올리기」 팝업 → 앨범
 *  - 수정 요청: 장 선택(여러 장) · 내용 · 그림 한 장 · 등록 → 댓글 · 본부 답글 · 해결됨
 *  080 표가 없으면 아무것도 그리지 않는다 (지금 화면 그대로)
 */
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Content } from '../hq.service';
import { Alt, Pick, PickRequest, Upload, addRequest, addUploads, completePick, getAlts, getPicks, listRequests, listUploads, orderBlocks, setPick } from '../carousel.service';
import { Err, Field, Mini } from '../ui';

const when = (iso: string) => { const d = new Date(iso); return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

// ── 확대 보기 (오피스 공통으로 쓸 수 있게 따로) ──
export interface LbItem { url: string; label: string }
export function Lightbox({ items, index, onIndex, onClose, action }: {
  items: LbItem[]; index: number; onIndex: (i: number) => void; onClose: () => void; action?: (i: number) => ReactNode;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [dx, setDx] = useState(0), [dy, setDy] = useState(0);
  const go = useCallback((d: number) => onIndex(Math.max(0, Math.min(items.length - 1, index + d))), [index, items.length, onIndex]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [go, onClose]);
  const down = (e: React.PointerEvent) => { start.current = { x: e.clientX, y: e.clientY }; };
  const move = (e: React.PointerEvent) => { if (!start.current) return; const x = e.clientX - start.current.x, y = e.clientY - start.current.y; if (Math.abs(x) > Math.abs(y)) { setDx(x); setDy(0); } else if (y > 0) { setDy(y); setDx(0); } };
  const up = () => {
    if (!start.current) return;
    if (dx < -50) go(1); else if (dx > 50) go(-1); else if (dy > 90) onClose();
    start.current = null; setDx(0); setDy(0);
  };
  const it = items[index];
  if (!it) return null;
  return (
    <div className="n-lb" role="dialog" aria-label="크게 보기">
      <div className="n-lb-top">
        <span className="n-lb-lbl">{it.label}</span>
        <span className="grow" />
        {action?.(index)}
        <button type="button" className="n-lb-x" onClick={onClose} aria-label="닫기">✕</button>
      </div>
      <div className="n-lb-stage" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <button type="button" className="n-lb-nav l" onClick={() => go(-1)} disabled={index === 0} aria-label="이전">‹</button>
        <img src={it.url} alt={it.label} draggable={false} style={{ transform: `translate(${dx}px, ${dy}px)`, opacity: dy ? Math.max(0.4, 1 - dy / 400) : 1 }} />
        <button type="button" className="n-lb-nav r" onClick={() => go(1)} disabled={index === items.length - 1} aria-label="다음">›</button>
      </div>
      <div className="n-lb-strip">{items.map((x, i) => (
        <button key={i} type="button" className={i === index ? 'on' : ''} onClick={() => onIndex(i)} aria-label={x.label}><img src={x.url} alt="" /></button>
      ))}</div>
      <div className="n-lb-hint">옆으로 넘겨 보기 · 아래로 쓸어내리면 닫힘</div>
    </div>
  );
}

// ── 사진 고르기 ──
export function CarouselPick({ c, ws, onChanged }: { c: Content; ws: string; onChanged: (patch: Partial<Content>) => void }) {
  const [alts, setAlts] = useState<Alt[] | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [pop, setPop] = useState<Alt | null>(null);
  const [lb, setLb] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  useEffect(() => {
    let live = true, made: Alt[] = [];
    getAlts(c.id).then(a => { made = a ?? []; if (live) setAlts(a); }).catch(setErr);
    getPicks(ws, c.id).then(p => live && setPicks(p)).catch(setErr);
    return () => { live = false; made.forEach(a => URL.revokeObjectURL(a.url)); };
  }, [c.id, ws]);
  if (!alts || !alts.length) return null;
  const slides = [...new Set(alts.map(a => a.slide))].sort((a, b) => a - b);
  const altN = Math.max(...alts.map(a => a.alt));   // 시목 사진 3안 · 쏠닝오즈 디자인 2안
  const design = altN === 2;
  const pickOf = (s: number) => picks.find(p => p.slide === s)?.alt;
  const done = slides.filter(s => pickOf(s)).length;
  const locked = c.pickStatus === 'done' || c.pickStatus === 'made';
  const choose = async (a: Alt) => {
    if (locked) return;
    setErr(null);
    try { await setPick(ws, c.id, a.slide, a.alt); setPicks(ps => [...ps.filter(p => p.slide !== a.slide), { slide: a.slide, alt: a.alt, by: '나' }]); } catch (e) { setErr(e); }
  };
  const pickAll = async (k: number) => {
    if (locked) return;
    setErr(null);
    try { for (const s of slides) await setPick(ws, c.id, s, k); setPicks(slides.map(s => ({ slide: s, alt: k, by: '나' }))); } catch (e) { setErr(e); }
  };
  const finish = async () => { setBusy(true); try { await completePick(c.id); onChanged({ pickStatus: 'done' }); } catch (e) { setErr(e); } finally { setBusy(false); } };
  const items = alts.map(a => ({ url: a.url, label: `${a.slide}장 · ${a.alt}안` }));
  const by = [...new Set(picks.map(p => p.by).filter(Boolean))].join(' · ');
  return (
    <Field label={design ? '디자인 고르기' : '사진 고르기'}>
      {!!err && <Err e={err} />}
      <div className="n-pk-head">
        <span className="n-pk-n">{slides.length}장 중 <b>{done}</b>장 선택</span>
        {by && <span className="n-pk-by">{by}</span>}
        <span className="grow" />
        {locked && <span className="n-b ok">{c.pickStatus === 'made' ? '확정본 제작' : '선택 완료'}</span>}
      </div>
      <div className="n-pk-bar"><i style={{ width: `${(done / slides.length) * 100}%` }} /></div>
      {!locked && design && <div className="n-pk-quick">{Array.from({ length: altN }, (_, i) => i + 1).map(k => <Mini key={k} primary={slides.every(s => pickOf(s) === k)} onClick={() => pickAll(k)}>모두 {k}안</Mini>)}<span className="n-pk-note" style={{ margin: 0 }}>장마다 바꿀 수도 있습니다</span></div>}
      {!locked && <div className="n-pk-note">{design ? '장을 누르면 크게 보고 선택할 수 있습니다' : '사진을 누르면 크게 보고 선택할 수 있습니다'}</div>}
      <div className="n-pk-rows">{slides.map(s => (
        <div key={s} className="n-pk-row">
          <div className="n-pk-no">{s}장{alts.some(a => a.slide === s && a.changed) && <span className="n-b warn">바뀜</span>}</div>
          <div className="n-pk-alts" style={{ gridTemplateColumns: `repeat(${altN}, minmax(0, 1fr))` }}>{alts.filter(a => a.slide === s).map(a => (
            <button key={a.alt} type="button" className={`n-pk-alt${pickOf(s) === a.alt ? ' on' : ''}`} onClick={() => setPop(a)} aria-label={`${s}장 ${a.alt}안`}>
              <img src={a.url} alt="" />
              <span className="n-pk-tag">{a.alt}안</span>
              {pickOf(s) === a.alt && <span className="n-pk-ck">✓</span>}
            </button>
          ))}</div>
        </div>
      ))}</div>
      {!locked && <button type="button" className="n-act n-pk-done" disabled={busy || done < slides.length} onClick={finish}>
        {done < slides.length ? `선택 완료 (${slides.length - done}장 남음)` : '선택 완료'}
      </button>}
      {c.pickStatus === 'done' && <div className="n-pk-note">본부가 고른 사진으로 확정본을 만듭니다</div>}

      {pop && (
        <div className="n-pop-bg" onClick={() => setPop(null)}>
          <div className="n-pop" onClick={e => e.stopPropagation()} role="dialog" aria-label="안 선택">
            <div className="n-pop-h"><b>{pop.slide}장 · {pop.alt}안</b><span className="grow" /><button type="button" className="n-lb-x dark" onClick={() => setPop(null)} aria-label="닫기">✕</button></div>
            <img className="n-pop-img" src={pop.url} alt="" />
            <div className="n-pop-f">
              <Mini onClick={() => { setLb(alts.indexOf(pop)); setPop(null); }}>⤢ 크게 보기</Mini>
              <span className="grow" />
              {!locked && <Mini primary onClick={() => { choose(pop); setPop(null); }}>{pickOf(pop.slide) === pop.alt ? '선택됨 ✓' : '✓ 이 안으로 선택'}</Mini>}
            </div>
          </div>
        </div>
      )}
      {lb != null && <Lightbox items={items} index={lb} onIndex={setLb} onClose={() => setLb(null)}
        action={i => locked ? null : (
          <button type="button" className={`n-lb-sel${pickOf(alts[i].slide) === alts[i].alt ? ' on' : ''}`} onClick={() => choose(alts[i])}>
            {pickOf(alts[i].slide) === alts[i].alt ? '선택됨 ✓' : '선택'}
          </button>)} />}
    </Field>
  );
}

// ── 이미지 주문서 · 사진 올리기 · 앨범 ──
export function OrderSection({ c, ws, slideCount }: { c: Content; ws: string; slideCount: number }) {
  const blocks = orderBlocks(c.orderMd);
  const [ups, setUps] = useState<Upload[] | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [upOpen, setUpOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [slide, setSlide] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [lb, setLb] = useState<number | null>(null);
  const load = useCallback(() => { listUploads(ws, c.id).then(setUps).catch(setErr); }, [ws, c.id]);
  useEffect(load, [load]);
  if (!blocks.length && !ups?.length) return null;
  const copy = async (i: number) => { await navigator.clipboard.writeText(blocks[i].text); setCopied(i); setTimeout(() => setCopied(x => (x === i ? null : x)), 1500); };
  const upload = async () => {
    setBusy(true); setErr(null);
    try { await addUploads(ws, c.id, slide ? Number(slide) : undefined, files); setUpOpen(false); setFiles([]); setSlide(''); load(); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <div className="n-f n-ord">
      <div className="n-ord-h"><label>이미지 주문서</label><span className="grow" />{ups && <Mini onClick={() => setUpOpen(true)}>＋ 사진 올리기</Mini>}</div>
      {!!err && <Err e={err} />}
      {blocks.map((b, i) => (
        <div key={i} className="n-ord-b">
          <div className="n-ord-t"><b>{b.title}</b>{b.optional ? <span className="n-b">선택 사항</span> : <span className="n-b warn">새로 만들어야 함</span>}</div>
          <div className="n-ord-box">
            <button type="button" className="n-ord-cp" onClick={() => copy(i)} aria-label="주문 글 복사">{copied === i ? '✓ 복사됨' : '⧉'}</button>
            <pre>{b.text}</pre>
          </div>
        </div>
      ))}
      {!!ups?.length && <>
        <div className="n-ord-al">올린 사진 {ups.length}</div>
        <div className="n-album">{ups.map((u, i) => (
          <button key={u.id} type="button" onClick={() => setLb(i)}>
            <img src={u.url} alt="" />
            <span className="n-b">{u.slide ? `${u.slide}장` : '장 지정 안 함'}</span>
            <small>{u.by ?? ''} · {when(u.at)}</small>
          </button>
        ))}</div>
      </>}
      {upOpen && (
        <div className="n-pop-bg" onClick={() => setUpOpen(false)}>
          <div className="n-pop" onClick={e => e.stopPropagation()} role="dialog" aria-label="사진 올리기">
            <div className="n-pop-h"><b>사진 올리기</b><span className="grow" /><button type="button" className="n-lb-x dark" onClick={() => setUpOpen(false)} aria-label="닫기">✕</button></div>
            <label className="n-up-pick">
              {files.length ? `${files.length}장 선택` : '사진 고르기 (여러 장)'}
              <input type="file" accept="image/*" multiple hidden onChange={e => { setFiles([...(e.target.files ?? [])].filter(f => f.type.startsWith('image/'))); e.target.value = ''; }} />
            </label>
            {!!files.length && <div className="n-up-prev">{files.map((f, i) => <img key={i} src={URL.createObjectURL(f)} alt="" />)}</div>}
            <div className="n-up-row"><span>어느 장에 쓸 사진인가요 (선택)</span>
              <select className="n-in" value={slide} onChange={e => setSlide(e.target.value)}>
                <option value="">장 지정 안 함</option>
                {Array.from({ length: Math.max(slideCount, 1) }, (_, i) => <option key={i} value={i + 1}>{i + 1}장</option>)}
              </select>
            </div>
            <div className="n-pop-f"><Mini onClick={() => setUpOpen(false)}>취소</Mini><span className="grow" /><Mini primary disabled={busy || !files.length} onClick={upload}>{busy ? '올리는 중' : `업로드 (${files.length}장)`}</Mini></div>
          </div>
        </div>
      )}
      {lb != null && ups && <Lightbox items={ups.map(u => ({ url: u.url, label: u.slide ? `${u.slide}장 · 올린 사진` : '올린 사진' }))} index={lb} onIndex={setLb} onClose={() => setLb(null)} />}
    </div>
  );
}

// ── 수정 요청 (맨 아래) ──
export function RequestSection({ c, ws, slideCount }: { c: Content; ws: string; slideCount: number }) {
  const [list, setList] = useState<PickRequest[] | null>(null);
  const [sel, setSel] = useState<number[]>([]);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [img, setImg] = useState<File | undefined>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const load = useCallback(() => { listRequests(ws, c.id).then(setList).catch(setErr); }, [ws, c.id]);
  useEffect(load, [load]);
  if (!list) return null;
  const n = Math.max(slideCount, 1);
  const label = sel.length ? sel.sort((a, b) => a - b).map(s => `${s}장`).join(', ') : '수정할 장 선택';
  const send = async () => {
    setBusy(true); setErr(null);
    try { await addRequest(ws, c.id, sel, body, img); setBody(''); setSel([]); setImg(undefined); load(); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <div className="n-f n-req">
      <hr className="n-req-hr" />
      <label>수정 요청</label>
      {!!err && <Err e={err} />}
      <div className="n-req-in">
        <div className="n-req-dd">
          <button type="button" className="n-in n-req-ddb" onClick={() => setOpen(o => !o)}>{label} ▾</button>
          {open && <div className="n-req-menu">
            {Array.from({ length: n }, (_, i) => i + 1).map(s => (
              <label key={s}><input type="checkbox" checked={sel.includes(s)} onChange={() => setSel(x => x.includes(s) ? x.filter(y => y !== s) : [...x, s])} />{s}장</label>
            ))}
            <Mini onClick={() => setOpen(false)}>닫기</Mini>
          </div>}
        </div>
        <div className="n-req-line">
          <input className="n-in" value={body} onChange={e => setBody(e.target.value)} placeholder="요청 내용 입력" onKeyDown={e => { if (e.key === 'Enter' && body.trim() && !busy) send(); }} />
          <label className={`n-req-img${img ? ' on' : ''}`} title="그림 첨부">🖼<input type="file" accept="image/*" hidden onChange={e => { setImg(e.target.files?.[0]); e.target.value = ''; }} /></label>
          <Mini primary disabled={busy || !body.trim()} onClick={send}>등록</Mini>
        </div>
      </div>
      {!list.length && <div className="n-pk-note">등록된 수정 요청이 없습니다</div>}
      <div className="n-req-list">{list.map(r => (
        <div key={r.id} className="n-req-it">
          <div className="n-req-m">
            {(r.slides.length ? r.slides.map(s => `${s}장`) : ['전체']).map(t => <span key={t} className="n-b">{t}</span>)}
            <b>{r.author ?? '멤버'}</b><small>{when(r.at)}</small>
            <span className="grow" />{r.resolved && <span className="n-b ok">해결됨</span>}
          </div>
          <div className="n-req-body">{r.body}</div>
          {r.image && <img className="n-req-pic" src={r.image} alt="첨부 그림" />}
          {r.reply && <div className="n-req-reply"><span className="n-b hq">본부</span><span>{r.reply}</span>{r.repliedAt && <small>{when(r.repliedAt)}</small>}</div>}
        </div>
      ))}</div>
    </div>
  );
}
