/**
 * @file src/components/office/NotificationBell.tsx
 * @description 인앱 알림센터 — 헤더 벨 아이콘 + 안읽음 뱃지 + 드롭다운 목록 (마이그 039)
 * - notify 함수가 쌓은 내 알림을 조회. 클릭 → 읽음 처리 + 관련 화면으로 이동.
 * - 푸시를 못 받아도 여기서 놓친 알림 확인.
 */
import { useEffect, useRef, useState } from 'react';
import { Workspace, AppNotification } from '../../types';
import { fetchNotifications, markRead, markAllRead } from '../../services/notifications.service';

/** 알림 type → 이동할 뷰 (자원 id를 모를 때 폴백) */
function viewOf(type: string): string {
  if (type.startsWith('notify_task') || type === 'notify_mention' || type === 'notify_like' || type === 'notify_comment') return 'todos';
  if (type === 'notify_schedule') return 'schedule';
  if (type === 'notify_content') return 'contents';
  return 'dashboard';
}

/**
 * 알림 → 착지 경로. tag에서 자원 종류·id를 파싱해 상세 화면으로 딥링크.
 * (좋아요/댓글이 무조건 '할일'로 가던 문제 해결)
 */
const RES_BASE: Record<string, string> = { task: 'todos', insight: 'insights', record: 'log', meeting: 'meetings' };
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
function linkOf(n: { type: string; tag?: string | null }): string {
  const tag = n.tag || '';
  // {resource}-comment|like-{resId}-…
  let m = tag.match(new RegExp(`^(task|insight|record|meeting)-(?:comment|like)-(${UUID})`, 'i'));
  if (m) return `${RES_BASE[m[1].toLowerCase()]}/${m[2]}`;
  // insight-{id} / record-{id} / meeting-{id} (생성 알림)
  m = tag.match(new RegExp(`^(insight|record|meeting)-(${UUID})$`, 'i'));
  if (m) return `${RES_BASE[m[1].toLowerCase()]}/${m[2]}`;
  // task-assign-{id}-… / task-{id}-done
  m = tag.match(new RegExp(`^task-(?:assign-)?(${UUID})`, 'i'));
  if (m) return `todos/${m[1]}`;
  return viewOf(n.type);
}
function ago(iso: string): string {
  try {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return '방금';
    if (s < 3600) return `${Math.floor(s / 60)}분 전`;
    if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
    return `${Math.floor(s / 86400)}일 전`;
  } catch { return ''; }
}

/** 종 SVG 아이콘 */
function BellIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

export function NotificationBell({ workspace, onNavigate }: { workspace: Workspace; onNavigate: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => fetchNotifications(workspace.id).then(setItems).catch(() => setItems([]));
  useEffect(() => {
    load();
    const t = setInterval(load, 60000); // 1분마다 갱신
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [workspace.id]);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const unread = items.filter((n) => !n.readAt).length;
  const onItem = async (n: AppNotification) => {
    if (!n.readAt) { await markRead(n.id); setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)); }
    setOpen(false);
    onNavigate(linkOf(n));
  };
  const readAll = async () => { await markAllRead(workspace.id); setItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() }))); };

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button onClick={() => { setOpen((o) => !o); if (!open) load(); }} title="알림" className="relative w-9 h-9 rounded-lg hover:bg-surface-muted flex items-center justify-center text-foreground-muted transition-colors active:scale-95">
        <BellIcon />
        {unread > 0 && <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 max-w-[86vw] bg-white rounded-xl shadow-xl border border-line z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-line">
            <span className="text-sm font-bold text-foreground">알림 {unread > 0 && <span className="text-rose-500">{unread}</span>}</span>
            {unread > 0 && <button onClick={readAll} className="text-[11px] text-foreground-faint hover:text-foreground">모두 읽음</button>}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-10 text-center">
                <BellIcon className="w-6 h-6 mx-auto text-foreground-faint mb-1.5" />
                <p className="text-xs text-foreground-faint">새 알림이 없어요</p>
              </div>
            ) : items.map((n) => (
              <button key={n.id} onClick={() => onItem(n)} className={`w-full text-left px-3.5 py-2.5 border-b border-line hover:bg-surface-muted transition-colors ${n.readAt ? '' : 'bg-surface-muted/40'}`}>
                <div className="flex items-center gap-1.5">
                  {!n.readAt && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />}
                  <span className="text-[13px] font-semibold text-foreground truncate flex-1">{n.title}</span>
                  <span className="text-[10px] text-foreground-faint flex-shrink-0">{ago(n.createdAt)}</span>
                </div>
                {n.body && <p className="text-[12px] text-foreground-muted mt-0.5 line-clamp-2 pl-3">{n.body}</p>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
