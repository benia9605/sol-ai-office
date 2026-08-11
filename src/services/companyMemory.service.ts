/**
 * @file src/services/companyMemory.service.ts
 * @description 회사 기억(company_memory) CRUD — 워크스페이스 스코프
 * - MVP: 30초 입력 + 검색. 임베딩/pgvector/자동추출 없음.
 * - 마이그레이션 031_company_memory.sql. Mock 동기화: mockSupabase.ts company_memory.
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { CompanyMemory, MemoryKind } from '../types';

interface MemoryRow {
  id: string;
  workspace_id: string;
  created_by?: string;
  kind?: MemoryKind;
  title: string;
  body?: string;
  summary?: string;
  tags?: string[];
  salience?: number;
  pinned?: boolean;
  status?: 'active' | 'archived';
  created_at?: string;
  updated_at?: string;
}

function toMemory(r: MemoryRow): CompanyMemory {
  return {
    id: r.id, workspaceId: r.workspace_id, kind: r.kind, title: r.title, body: r.body,
    summary: r.summary, tags: r.tags, salience: r.salience ?? undefined, pinned: r.pinned ?? false,
    status: r.status ?? 'active', createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/** camelCase → snake_case (Mock 동기화: mockSupabase.ts company_memory 매핑) */
function toRow(f: Partial<CompanyMemory>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (f.kind !== undefined) p.kind = f.kind || null;
  if (f.title !== undefined) p.title = f.title;
  if (f.body !== undefined) p.body = f.body || null;
  if (f.summary !== undefined) p.summary = f.summary || null;
  if (f.tags !== undefined) p.tags = f.tags || null;
  if (f.salience !== undefined) p.salience = f.salience ?? null;
  if (f.pinned !== undefined) p.pinned = f.pinned;
  if (f.status !== undefined) p.status = f.status;
  return p;
}

/** 워크스페이스 기억 목록 (고정 우선 + 최신순) */
export async function fetchMemories(workspaceId: string): Promise<CompanyMemory[]> {
  const { data, error } = await supabase
    .from('company_memory')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toMemory);
}

/** 기억 추가 */
export async function addMemory(workspaceId: string, fields: Partial<CompanyMemory>): Promise<CompanyMemory> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('company_memory')
    .insert({ workspace_id: workspaceId, created_by: userId, status: 'active', ...toRow(fields) })
    .select()
    .single();
  if (error) throw error;
  return toMemory(data);
}

/** 기억 수정 */
export async function updateMemory(id: string, fields: Partial<CompanyMemory>): Promise<void> {
  const { error } = await supabase
    .from('company_memory')
    .update({ ...toRow(fields), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** 기억 삭제 */
export async function deleteMemory(id: string): Promise<void> {
  const { error } = await supabase.from('company_memory').delete().eq('id', id);
  if (error) throw error;
}

// TODO: Context Engine (Phase 7, 대표 실사용 후 착수)
// recallMemory(workspaceId, query, { kinds?, k }) — 질문과 관련된 기억 top-K 인출.
// MVP는 임베딩 없이 키워드/태그 매칭으로 시작 예정. 이 파일에 위치.
