/**
 * @file src/services/contentMetrics.service.ts
 * @description 콘텐츠 성과(content_metrics) — 24h/72h/7d 스냅샷 CRUD
 * - 저장률·공유율은 저장하지 않고 views/saves/shares로 앱에서 계산.
 * - 마이그레이션 029_content_metrics.sql. Mock 동기화: mockSupabase.ts content_metrics.
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { ContentMetric, ContentCheckpoint } from '../types';

interface ContentMetricRow {
  id: string;
  workspace_id: string;
  content_item_id: string;
  checkpoint: ContentCheckpoint;
  views?: number;
  likes?: number;
  comments?: number;
  saves?: number;
  shares?: number;
  watch_time?: number;
  completion_rate?: number;
  follower_delta?: number;
  measured_at?: string;
  created_at?: string;
}

function toMetric(r: ContentMetricRow): ContentMetric {
  return {
    id: r.id, workspaceId: r.workspace_id, contentItemId: r.content_item_id, checkpoint: r.checkpoint,
    views: r.views, likes: r.likes, comments: r.comments, saves: r.saves, shares: r.shares,
    watchTime: r.watch_time, completionRate: r.completion_rate, followerDelta: r.follower_delta,
    measuredAt: r.measured_at, createdAt: r.created_at,
  };
}

function toRow(f: Partial<ContentMetric>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (f.views !== undefined) p.views = f.views ?? null;
  if (f.likes !== undefined) p.likes = f.likes ?? null;
  if (f.comments !== undefined) p.comments = f.comments ?? null;
  if (f.saves !== undefined) p.saves = f.saves ?? null;
  if (f.shares !== undefined) p.shares = f.shares ?? null;
  if (f.watchTime !== undefined) p.watch_time = f.watchTime ?? null;
  if (f.completionRate !== undefined) p.completion_rate = f.completionRate ?? null;
  if (f.followerDelta !== undefined) p.follower_delta = f.followerDelta ?? null;
  if (f.measuredAt !== undefined) p.measured_at = f.measuredAt || null;
  return p;
}

/** 워크스페이스의 모든 성과 스냅샷 (분석 집계용) */
export async function fetchMetricsByWorkspace(workspaceId: string): Promise<ContentMetric[]> {
  const { data, error } = await supabase
    .from('content_metrics')
    .select('*')
    .eq('workspace_id', workspaceId);
  if (error) throw error;
  return (data ?? []).map(toMetric);
}

/** 콘텐츠 1건의 시점별 성과 */
export async function fetchMetricsByItem(contentItemId: string): Promise<ContentMetric[]> {
  const { data, error } = await supabase
    .from('content_metrics')
    .select('*')
    .eq('content_item_id', contentItemId);
  if (error) throw error;
  return (data ?? []).map(toMetric);
}

/**
 * 시점(checkpoint)별 성과 upsert — 있으면 update, 없으면 insert.
 * (mock/real 양쪽에서 안전하도록 upsert 대신 조회 후 분기)
 */
export async function saveMetric(
  workspaceId: string, contentItemId: string, checkpoint: ContentCheckpoint, fields: Partial<ContentMetric>,
): Promise<void> {
  const { data: existing } = await supabase
    .from('content_metrics')
    .select('id')
    .eq('content_item_id', contentItemId)
    .eq('checkpoint', checkpoint)
    .limit(1);

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from('content_metrics')
      .update({ ...toRow(fields), updated_at: new Date().toISOString() })
      .eq('id', existing[0].id);
    if (error) throw error;
  } else {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from('content_metrics')
      .insert({ workspace_id: workspaceId, content_item_id: contentItemId, checkpoint, user_id: userId, ...toRow(fields) });
    if (error) throw error;
  }
}
