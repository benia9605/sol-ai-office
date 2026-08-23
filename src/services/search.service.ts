/**
 * @file src/services/search.service.ts
 * @description 오피스 전체 검색 — 할일·인사이트·기록·회의·콘텐츠를 제목으로 통합 검색
 * - 워크스페이스 스코프 + RLS(팀 공유분만). 각 자원 병렬 조회 후 합쳐서 반환.
 */
import { supabase } from './supabase';

export type SearchType = 'task' | 'insight' | 'record' | 'meeting' | 'content';
export interface SearchResult { type: SearchType; id: string; title: string; sub?: string; }

/** type → 상세 화면 경로 (OfficeShell onNavigate에 넘김) */
export const SEARCH_BASE: Record<SearchType, string> = {
  task: 'todos', insight: 'insights', record: 'log', meeting: 'meetings', content: 'contents',
};
export const SEARCH_LABEL: Record<SearchType, string> = {
  task: '할일', insight: '인사이트', record: '기록', meeting: '회의', content: '콘텐츠',
};

/** 오피스 전체에서 제목으로 검색 (자원별 최대 8건). q가 비면 빈 배열. */
export async function searchWorkspace(workspaceId: string, q: string): Promise<SearchResult[]> {
  const term = q.trim();
  if (term.length < 1) return [];
  const like = `%${term.replace(/[%_]/g, '')}%`;
  const one = (table: string, type: SearchType, extra?: (qb: any) => any) => {
    let qb = supabase.from(table).select('id, title').eq('workspace_id', workspaceId).ilike('title', like).limit(8);
    if (extra) qb = extra(qb);
    return qb.then(({ data }: { data: { id: string; title: string }[] | null }) =>
      (data ?? []).map((r) => ({ type, id: r.id, title: r.title })),
    ).catch(() => [] as SearchResult[]);
  };
  const groups = await Promise.all([
    one('tasks', 'task'),
    one('insights', 'insight'),
    one('journals', 'record', (qb) => qb.eq('record_type', 'memo')),
    one('meetings', 'meeting'),
    one('content_items', 'content'),
  ]);
  return groups.flat();
}
