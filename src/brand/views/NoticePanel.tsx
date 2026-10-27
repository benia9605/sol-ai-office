/**
 * @file src/brand/views/NoticePanel.tsx
 * @description 알림함 - 기존 인앱 알림(notifications, 마이그 039)을 브랜드 오피스 모양으로
 *  폰 알림을 못 봤어도 여기서 본다. 누르면 읽음 + 그 화면으로 (알림 url = /w/<id>/...)
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppNotification } from '../../types';
import { fetchNotifications, markAllRead, markRead } from '../../services/notifications.service';
import { fmtTime } from '../hq.service';
import { Empty, List, Mini, Panel, Row } from '../ui';

/** 안 읽은 알림 수 - 창으로 돌아올 때마다 다시 센다 */
export function useNotices(ws: string) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const load = useCallback(() => { fetchNotifications(ws, 40).then(setItems).catch(() => {}); }, [ws]);
  useEffect(() => {
    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [load]);
  return { items, unread: items.filter(n => !n.readAt).length, reload: load };
}

export function NoticePanel({ ws, items, onClose, reload }: { ws: string; items: AppNotification[]; onClose: () => void; reload: () => void }) {
  const navigate = useNavigate();
  const open = async (n: AppNotification) => {
    if (!n.readAt) await markRead(n.id);
    reload(); onClose();
    if (n.url?.startsWith('/')) navigate(n.url);
  };
  const unread = items.some(n => !n.readAt);
  return (
    <Panel title="알림" onClose={onClose}
      foot={unread ? <><span className="grow" /><Mini onClick={async () => { await markAllRead(ws); reload(); }}>모두 읽음</Mini></> : undefined}>
      {items.length ? <List>{items.map(n => (
        <Row key={n.id} done={!!n.readAt} onClick={() => open(n)} title={n.title}
          desc={<>{n.body}<br /><span style={{ color: 'var(--muted)' }}>{fmtTime(n.createdAt)}</span></>}
          right={!n.readAt ? <span className="n-dot" aria-label="안 읽음" /> : undefined} />
      ))}</List> : <Empty>알림 없음</Empty>}
    </Panel>
  );
}
