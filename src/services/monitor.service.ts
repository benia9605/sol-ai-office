/**
 * @file src/services/monitor.service.ts
 * @description 모니터링 = 트렌드 레이더 — 워치리스트 CRUD + 시목 시드 + 콘텐츠 연결 (마이그 035)
 * - 경쟁사(direct/adjacent/aspirational) + 고객 키워드(product/desire/mood/format) 감시.
 * - 트렌드 키워드 → content_items 아이디어로 넘기기(그대로 베끼지 않게 훅만).
 * - Mock 동기화: mockSupabase watch_items / watch_snapshots.
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { WatchItem, WatchKind } from '../types';
import { addContentItem } from './contentItems.service';

const toItem = (r: any): WatchItem => ({
  id: r.id, workspaceId: r.workspace_id, kind: (r.kind || 'competitor') as WatchKind, name: r.name,
  url: r.url, watchType: r.watch_type, topics: r.topics ?? undefined, memo: r.memo,
  status: r.status, lastCheckedAt: r.last_checked_at, createdAt: r.created_at,
});

export async function fetchWatchItems(workspaceId: string): Promise<WatchItem[]> {
  const { data, error } = await supabase.from('watch_items').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toItem);
}

export async function addWatchItem(workspaceId: string, fields: Partial<WatchItem> & { name: string; kind: WatchKind }): Promise<void> {
  const userId = await getCurrentUserId().catch(() => null);
  const { error } = await supabase.from('watch_items').insert({
    workspace_id: workspaceId, created_by: userId, kind: fields.kind, name: fields.name,
    url: fields.url ?? null, watch_type: fields.watchType ?? null, topics: fields.topics ?? null, memo: fields.memo ?? null, status: 'active',
  });
  if (error) throw error;
}

export async function deleteWatchItem(id: string): Promise<void> {
  const { error } = await supabase.from('watch_items').delete().eq('id', id);
  if (error) throw error;
}

/** 트렌드 키워드 → 시목 콘텐츠 아이디어로 (그대로 베끼지 않고 각도만) */
export async function watchToContentIdea(workspaceId: string, item: WatchItem): Promise<void> {
  await addContentItem(workspaceId, {
    title: `[트렌드] ${item.name} — 시목 버전`,
    contentType: 'info',
    status: 'idea',
    hook: `"${item.name}"을 시목 원목 관점(오래 쓰는 물건)으로 재해석`,
  });
}

/** 시목 워치리스트 시드 — 경쟁사 + 고객 키워드 (GPT 제안) */
const COMPETITORS: { name: string; watchType: string }[] = [
  { name: 'nothing at all', watchType: 'direct' },
  { name: '고재가구 편집숍', watchType: 'direct' },
  { name: '윤현상재', watchType: 'adjacent' },
  { name: '오늘의집 인기 우드 브랜드', watchType: 'adjacent' },
  { name: 'Kenneth Cobonpue', watchType: 'aspirational' },
  { name: '드롭드롭드롭', watchType: 'aspirational' },
];
const KEYWORDS: { name: string; watchType: string }[] = [
  // 제품
  { name: '티크 도마', watchType: 'product' }, { name: '엔드그레인 도마', watchType: 'product' }, { name: '고재 가구', watchType: 'product' },
  // 생활 욕망
  { name: '주방 인테리어', watchType: 'desire' }, { name: '홈카페', watchType: 'desire' }, { name: '오래 쓰는 물건', watchType: 'desire' }, { name: '집꾸미기', watchType: 'desire' },
  // 감성
  { name: '내추럴 인테리어', watchType: 'mood' }, { name: '빈티지 우드', watchType: 'mood' }, { name: '코티지 인테리어', watchType: 'mood' },
  // 콘텐츠 포맷
  { name: 'before after', watchType: 'format' }, { name: '살림 루틴', watchType: 'format' }, { name: '평생 쓰는', watchType: 'format' },
];

export async function seedSimokWatchlist(workspaceId: string): Promise<number> {
  const userId = await getCurrentUserId().catch(() => null);
  const existing = await fetchWatchItems(workspaceId).catch(() => [] as WatchItem[]);
  const existNames = new Set(existing.map(w => w.name));
  const rows = [
    ...COMPETITORS.map(c => ({ kind: 'competitor', name: c.name, watch_type: c.watchType })),
    ...KEYWORDS.map(k => ({ kind: 'keyword', name: k.name, watch_type: k.watchType })),
  ].filter(r => !existNames.has(r.name))
    .map(r => ({ workspace_id: workspaceId, created_by: userId, kind: r.kind, name: r.name, watch_type: r.watch_type, status: 'active' }));
  if (rows.length === 0) return 0;
  const { error } = await supabase.from('watch_items').insert(rows);
  if (error) throw error;
  return rows.length;
}
