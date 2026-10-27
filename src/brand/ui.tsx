/**
 * @file src/brand/ui.tsx
 * @description 브랜드 오피스 공통 부품 - 화면 규격(시안 「화면 규격」 표)을 코드로 고정한다
 *  PageHead · Tabs · Sec · Card · List/Row · Badge · Panel(PC 서랍 · 폰 아래 판) · Field · Seg
 *  모든 메뉴는 이것만 쓴다. 새 모양이 필요하면 여기에 먼저 만든다.
 */
import { ReactNode, useEffect, useState } from 'react';
import { WorkspaceMember } from '../types';
import { HqComment, HqRef, Source, addHqComment, deleteHqComment, fmtTime, listHqComments } from './hq.service';

export function PageHead({ title, small, action }: { title: string; small?: string; action?: ReactNode }) {
  return (
    <div className="n-pagewrap">
      <div className="n-page"><h1>{title}{small && <small>{small}</small>}</h1>{action}</div>
    </div>
  );
}

export function Act({ children, ghost, onClick, disabled }: { children: ReactNode; ghost?: boolean; onClick?: () => void; disabled?: boolean }) {
  return <button type="button" className={`n-act${ghost ? ' ghost' : ''}`} onClick={onClick} disabled={disabled}>{children}</button>;
}
export function Mini({ children, primary, onClick, disabled }: { children: ReactNode; primary?: boolean; onClick?: (e: React.MouseEvent) => void; disabled?: boolean }) {
  return <button type="button" className={`n-mini${primary ? ' p' : ''}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

export function Tabs<T extends string>({ items, value, onChange }: { items: { key: T; label: string; count?: number }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="n-tabs" role="tablist">
      {items.map(i => (
        <button key={i.key} type="button" role="tab" aria-selected={i.key === value} className={i.key === value ? 'on' : ''} onClick={() => onChange(i.key)}>
          {i.label}{i.count != null && <span>{i.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** 섹션 - 머리는 카드 밖, 내용은 카드 안 */
export function Sec({ title, count, link, onLink, children }: { title: string; count?: ReactNode; link?: string; onLink?: () => void; children: ReactNode }) {
  return (
    <section className="n-sec">
      <div className="n-sh">
        <h2>{title}</h2>
        {count != null && count !== '' && <span className="cnt">{count}</span>}
        {link && <button type="button" className="lnk" onClick={onLink}>{link}</button>}
      </div>
      {children}
    </section>
  );
}
export const Card = ({ children, pad }: { children: ReactNode; pad?: boolean }) => <div className={`n-card${pad ? ' pad' : ''}`}>{children}</div>;
export const G2 = ({ children }: { children: ReactNode }) => <div className="n-g2">{children}</div>;
export const List = ({ children }: { children: ReactNode }) => <ul className="n-list">{children}</ul>;

export function Row({ left, title, desc, right, done, onClick }: { left?: ReactNode; title: ReactNode; desc?: ReactNode; right?: ReactNode; done?: boolean; onClick?: () => void }) {
  return (
    <li className={`${done ? 'done' : ''}${onClick ? ' click' : ''}`} onClick={onClick}>
      {left}
      <div className="m"><div className="t">{title}</div>{desc && <div className="d">{desc}</div>}</div>
      {right && <div className="r" onClick={e => e.stopPropagation()}>{right}</div>}
    </li>
  );
}
export const Kind = ({ children }: { children: ReactNode }) => <span className="l k">{children}</span>;
export function Check({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <span className="l" onClick={e => e.stopPropagation()}>
      <button type="button" className={`n-ck${on ? ' on' : ''}`} aria-pressed={on} aria-label={label} onClick={onToggle} />
    </span>
  );
}

/** 뱃지 - 자동(본부) · 직접 · 그 밖 */
export function Badge({ source, children }: { source?: Source | 'carry'; children?: ReactNode }) {
  if (source === 'hq') return <span className="n-b hq">자동</span>;
  if (source === 'me') return <span className="n-b me">직접</span>;
  if (source === 'carry') return <span className="n-b">이월</span>;
  return <span className="n-b">{children}</span>;
}
export const Ex = () => <span className="n-ex">예시</span>;

/** 겹치는 판 - PC 오른쪽 서랍 · 폰 아래에서 올라오는 판. 뒤 화면은 고정, 판 안만 스크롤 */
export function Panel({ title, tag, onClose, children, foot }: { title: string; tag?: string; onClose: () => void; children: ReactNode; foot?: ReactNode }) {
  useLockScroll();
  useEsc(onClose);
  return (
    <>
      <div className="n-dim" onClick={onClose} />
      <div className="n-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="n-ph">{tag && <span className="n-b hq">{tag}</span>}<b>{title}</b><button type="button" className="x" aria-label="닫기" onClick={onClose}>✕</button></div>
        <div className="n-pb">{children}</div>
        {foot && <div className="n-pf">{foot}</div>}
      </div>
    </>
  );
}
export function useLockScroll() {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
}
export function useEsc(fn: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') fn(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [fn]);
}

export const Field = ({ label, children }: { label: string; children: ReactNode }) => <div className="n-f"><label>{label}</label>{children}</div>;
export function Seg<T extends string>({ items, value, onChange, col }: { items: { key: T; label: string }[]; value: T | undefined; onChange: (k: T) => void; col?: boolean }) {
  return (
    <div className={`n-seg${col ? ' col' : ''}`}>
      {items.map(i => <button key={i.key} type="button" className={i.key === value ? 'on' : ''} onClick={() => onChange(i.key)}>{i.label}</button>)}
    </div>
  );
}

/** 담당 - 워크스페이스 멤버 이름 그대로 + 공동 */
export function memberName(members: WorkspaceMember[], userId?: string): string {
  const m = members.find(x => x.userId === userId);
  return m?.nickname || m?.name || (m ? '멤버' : '');
}
export function AssigneeSeg({ members, userId, shared, onChange }: { members: WorkspaceMember[]; userId?: string; shared: boolean; onChange: (v: { userId?: string; shared: boolean }) => void }) {
  const items = [...members.map(m => ({ key: m.userId, label: m.nickname || m.name || '멤버' })), { key: '__shared', label: '공동' }];
  const value = shared ? '__shared' : userId;
  return <Seg items={items} value={value} onChange={k => onChange(k === '__shared' ? { shared: true } : { userId: k, shared: false })} />;
}

/** 일정 고르기 - 오늘 · 내일 · 날짜 */
export function DueSeg({ value, onChange, today, tomorrow }: { value?: string; onChange: (d?: string) => void; today: string; tomorrow: string }) {
  const custom = value && value !== today && value !== tomorrow;
  return (
    <div className="n-seg">
      <button type="button" className={!value || value === today ? 'on' : ''} onClick={() => onChange(undefined)}>오늘</button>
      <button type="button" className={value === tomorrow ? 'on' : ''} onClick={() => onChange(tomorrow)}>내일</button>
      <input type="date" className={`n-in${custom ? '' : ' ph'}`} style={{ width: 'auto', padding: '6px 10px' }} value={custom ? value : ''} min={today} onChange={e => onChange(e.target.value || undefined)} aria-label="날짜 선택" />
    </div>
  );
}

export const Err = ({ e }: { e: unknown }) => <div className="n-err">불러오지 못했습니다 · {e instanceof Error ? e.message : String(e)}</div>;
export const Empty = ({ children }: { children: ReactNode }) => <div className="n-empty">{children}</div>;
export const Skeleton = () => <div className="n-card pad"><div className="n-skel" /><div className="n-skel" style={{ width: '70%' }} /><div className="n-skel" style={{ width: '50%' }} /></div>;

/** 댓글 - 이름 · 내용 · 시간이 쌓인다 (오피스 기록). 내가 단 것만 지운다. about = 다른 멤버 알림 제목 · 누르면 갈 곳 */
export function Thread({ ws, refType, refId, members, myId, about }: {
  ws: string; refType: HqRef; refId: string; members: WorkspaceMember[]; myId: string; about: { label: string; path: string };
}) {
  const [items, setItems] = useState<HqComment[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { listHqComments(ws, refType, [refId]).then(m => setItems(m[refId] ?? [])).catch(() => setItems([])); }, [ws, refType, refId]);
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true); setErr('');
    try { const c = await addHqComment(ws, refType, refId, text, about); setItems(xs => [...(xs ?? []), c]); setText(''); }
    catch { setErr('저장 안 됨 - 다시 눌러 주세요'); } finally { setBusy(false); }
  };
  const del = async (id: string) => { if (await deleteHqComment(id).catch(() => false)) setItems(xs => (xs ?? []).filter(x => x.id !== id)); };
  return (
    <div className="n-thread">
      {items?.map(c => {
        const name = memberName(members, c.userId) || '멤버';
        return (
          <div className="n-cmt" key={c.id}>
            <span className="n-av">{name[0]}</span>
            <div className="b">
              <div className="h"><b>{name}</b><time>{fmtTime(c.at)}</time>{c.userId === myId && <button type="button" className="del" onClick={() => del(c.id)}>삭제</button>}</div>
              <div className="t">{c.text}</div>
            </div>
          </div>
        );
      })}
      <div className="n-cin">
        <textarea className="n-in area" rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="댓글 남기기" />
        <div className="n-cbar">{err && <span className="n-cerr">{err}</span>}<Mini primary onClick={send} disabled={busy || !text.trim()}>{busy ? '저장 중' : '저장'}</Mini></div>
      </div>
    </div>
  );
}
