/**
 * @file src/services/brandContexts.service.ts
 * @description 회사 브레인(brand_contexts) CRUD — AI 직원 프롬프트 ①계층
 * - 워크스페이스 1:1. 사장이 직접 입력 → 모든 직원 시스템 프롬프트 최상단에 주입.
 * - 설계: docs/guides/ai오피스구축/_직원별_실행스펙_시목.md §0
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { BrandContext } from '../types';

interface BrandContextRow {
  id: string;
  workspace_id: string;
  user_id: string;
  identity?: string;
  category?: string;
  tone?: string;
  target?: string;
  usp?: string;
  channels?: string;
  price_position?: string;
  ad_angle?: string;
  compliance?: string;
  main_products?: string;
  price_range?: string;
  competitors?: string;
  story?: string;
  raw?: string;
  version?: number;
  updated_at?: string;
}

function fromRow(r: BrandContextRow): BrandContext {
  return {
    id: r.id, workspaceId: r.workspace_id,
    identity: r.identity ?? '', category: r.category ?? '', tone: r.tone ?? '',
    target: r.target ?? '', usp: r.usp ?? '', channels: r.channels ?? '',
    pricePosition: r.price_position ?? '', adAngle: r.ad_angle ?? '',
    compliance: r.compliance ?? '', mainProducts: r.main_products ?? '',
    priceRange: r.price_range ?? '', competitors: r.competitors ?? '',
    story: r.story ?? '', raw: r.raw ?? '',
    version: r.version ?? 1, updatedAt: r.updated_at,
  };
}

/** camelCase 입력 → snake_case 컬럼 (Mock 동기화: mockSupabase.ts brand_contexts 매핑) */
function toRowPayload(fields: Partial<BrandContext>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (fields.identity !== undefined) p.identity = fields.identity;
  if (fields.category !== undefined) p.category = fields.category;
  if (fields.tone !== undefined) p.tone = fields.tone;
  if (fields.target !== undefined) p.target = fields.target;
  if (fields.usp !== undefined) p.usp = fields.usp;
  if (fields.channels !== undefined) p.channels = fields.channels;
  if (fields.pricePosition !== undefined) p.price_position = fields.pricePosition;
  if (fields.adAngle !== undefined) p.ad_angle = fields.adAngle;
  if (fields.compliance !== undefined) p.compliance = fields.compliance;
  if (fields.mainProducts !== undefined) p.main_products = fields.mainProducts;
  if (fields.priceRange !== undefined) p.price_range = fields.priceRange;
  if (fields.competitors !== undefined) p.competitors = fields.competitors;
  if (fields.story !== undefined) p.story = fields.story;
  if (fields.raw !== undefined) p.raw = fields.raw;
  return p;
}

/** 워크스페이스의 회사 브레인 (없으면 null) */
export async function fetchBrandContext(workspaceId: string): Promise<BrandContext | null> {
  const { data, error } = await supabase
    .from('brand_contexts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data) : null;
}

/** 회사 브레인 저장 (없으면 생성, 있으면 갱신) */
export async function saveBrandContext(
  workspaceId: string, fields: Partial<BrandContext>,
): Promise<BrandContext> {
  const userId = await getCurrentUserId();
  const existing = await fetchBrandContext(workspaceId);

  if (existing) {
    const { data, error } = await supabase
      .from('brand_contexts')
      .update({ ...toRowPayload(fields), version: (existing.version ?? 1) + 1, updated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .select()
      .single();
    if (error) throw error;
    return fromRow(data);
  }

  const { data, error } = await supabase
    .from('brand_contexts')
    .insert({ workspace_id: workspaceId, user_id: userId, ...toRowPayload(fields), version: 1 })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

/**
 * 회사 브레인 → 시스템 프롬프트 ①계층 텍스트로 직렬화.
 * staffRun / edge function이 buildSystemPrompt 최상단에 주입.
 */
export function brandContextToPrompt(bc: BrandContext | null, fallbackName: string): string {
  if (!bc) return `[회사] ${fallbackName}`;
  const lines: string[] = [`[회사 브레인 — 이 회사의 정체성. 모든 답변의 기준]`];
  const add = (label: string, v?: string) => { if (v && v.trim()) lines.push(`- ${label}: ${v.trim()}`); };
  add('정체성', bc.identity);
  add('카테고리', bc.category);
  add('톤앤매너', bc.tone);
  add('타겟', bc.target);
  add('핵심 USP', bc.usp);
  add('판매 채널', bc.channels);
  add('가격 포지셔닝', bc.pricePosition);
  add('광고 소구점', bc.adAngle);
  add('주력 상품', bc.mainProducts);
  add('대표 가격대', bc.priceRange);
  add('경쟁사', bc.competitors);
  add('스토리', bc.story);
  if (bc.compliance && bc.compliance.trim()) lines.push(`- ⚠️ 금지표현(반드시 준수): ${bc.compliance.trim()}`);
  if (bc.raw && bc.raw.trim()) lines.push(`- 추가 설명: ${bc.raw.trim()}`);
  return lines.join('\n');
}
