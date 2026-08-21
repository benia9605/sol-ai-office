/**
 * @file src/services/contentItems.service.ts
 * @description 콘텐츠 아이템(content_items) CRUD — 워크스페이스 스코프
 * - 아이디어→발행 수명주기(MVP). 마이그레이션 027_content_items.sql.
 * - Mock 동기화: mockSupabase.ts content_items 시드.
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { ContentItem, ContentType, ContentStatus } from '../types';

interface ContentItemRow {
  id: string;
  workspace_id: string;
  created_by?: string;
  title: string;
  platform?: string;
  content_type?: ContentType;
  status: ContentStatus;
  hook?: string;
  script?: string;
  shot_list?: string;
  url?: string;
  published_at?: string;
  primary_product_id?: string;
  content_purpose?: string;
  owner?: string;
  scheduled_for?: string;
  created_at?: string;
  updated_at?: string;
}

function toItem(r: ContentItemRow): ContentItem {
  return {
    id: r.id, workspaceId: r.workspace_id, title: r.title, platform: r.platform,
    contentType: r.content_type, status: r.status, hook: r.hook, script: r.script,
    shotList: r.shot_list, url: r.url, publishedAt: r.published_at,
    primaryProductId: r.primary_product_id, contentPurpose: r.content_purpose,
    owner: r.owner, scheduledFor: r.scheduled_for,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/** camelCase 입력 → snake_case 컬럼 (Mock 동기화: mockSupabase.ts content_items 매핑) */
function toRow(fields: Partial<ContentItem>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (fields.title !== undefined) p.title = fields.title;
  if (fields.platform !== undefined) p.platform = fields.platform || null;
  if (fields.contentType !== undefined) p.content_type = fields.contentType || null;
  if (fields.status !== undefined) p.status = fields.status;
  if (fields.hook !== undefined) p.hook = fields.hook || null;
  if (fields.script !== undefined) p.script = fields.script || null;
  if (fields.shotList !== undefined) p.shot_list = fields.shotList || null;
  if (fields.url !== undefined) p.url = fields.url || null;
  if (fields.publishedAt !== undefined) p.published_at = fields.publishedAt || null;
  if (fields.primaryProductId !== undefined) p.primary_product_id = fields.primaryProductId || null;
  if (fields.contentPurpose !== undefined) p.content_purpose = fields.contentPurpose || null;
  if (fields.owner !== undefined) p.owner = fields.owner || null;
  if (fields.scheduledFor !== undefined) p.scheduled_for = fields.scheduledFor || null;
  return p;
}

/** 워크스페이스 콘텐츠 목록 (최신순) */
export async function fetchContentItems(workspaceId: string): Promise<ContentItem[]> {
  const { data, error } = await supabase
    .from('content_items')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map(toItem);
}

/** 콘텐츠 추가 */
export async function addContentItem(workspaceId: string, fields: Partial<ContentItem>): Promise<ContentItem> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('content_items')
    .insert({ workspace_id: workspaceId, created_by: userId, status: 'idea', ...toRow(fields) })
    .select()
    .single();
  if (error) throw error;
  return toItem(data);
}

/** 콘텐츠 수정 */
export async function updateContentItem(id: string, fields: Partial<ContentItem>): Promise<void> {
  const { error } = await supabase
    .from('content_items')
    .update({ ...toRow(fields), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** 콘텐츠 삭제 */
export async function deleteContentItem(id: string): Promise<void> {
  const { error } = await supabase.from('content_items').delete().eq('id', id);
  if (error) throw error;
}
