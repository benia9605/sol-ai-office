/**
 * @file src/services/products.service.ts
 * @description 제품 카탈로그(products) CRUD — 워크스페이스 스코프
 * - 콘텐츠/매출/소싱의 기반 데이터. 마이그레이션 026_products.sql.
 * - Mock 동기화: mockSupabase.ts products 시드.
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { Product } from '../types';
import { ErpSource } from '../config/dataSource';
import { erpProxyGet, SimokProduct } from './simokErp';

interface ProductRow {
  id: string;
  workspace_id: string;
  created_by?: string;
  name: string;
  sku?: string;
  category?: string;
  status: 'active' | 'draft' | 'discontinued';
  price?: number;
  cost?: number;
  stock?: number;
  image_url?: string;
  description?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

function toProduct(r: ProductRow): Product {
  return {
    id: r.id, workspaceId: r.workspace_id, name: r.name, sku: r.sku,
    category: r.category, status: r.status, price: r.price ?? undefined,
    cost: r.cost ?? undefined, stock: r.stock ?? undefined, imageUrl: r.image_url,
    description: r.description, tags: r.tags, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/** camelCase 입력 → snake_case 컬럼 (Mock 동기화: mockSupabase.ts products 매핑) */
function toRow(fields: Partial<Product>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (fields.name !== undefined) p.name = fields.name;
  if (fields.sku !== undefined) p.sku = fields.sku || null;
  if (fields.category !== undefined) p.category = fields.category || null;
  if (fields.status !== undefined) p.status = fields.status;
  if (fields.price !== undefined) p.price = fields.price ?? null;
  if (fields.cost !== undefined) p.cost = fields.cost ?? null;
  if (fields.stock !== undefined) p.stock = fields.stock ?? null;
  if (fields.imageUrl !== undefined) p.image_url = fields.imageUrl || null;
  if (fields.description !== undefined) p.description = fields.description || null;
  if (fields.tags !== undefined) p.tags = fields.tags || null;
  return p;
}

/**
 * 시목 앱 API에서 제품 마스터 조회 (System of Record).
 * 계약 ⑪: business_entity='시목' 필터, status는 발행 상품페이지 등록 기준(active/draft).
 * ※ ERP_SOURCE는 현재 전역 스위치라 v1은 시목 워크스페이스 전용으로 간주(다른 브랜드 ERP 붙으면 워크스페이스별 라우팅 필요).
 */
async function fetchProductsFromSimok(workspaceId: string): Promise<Product[]> {
  const rows = await erpProxyGet<SimokProduct>('products', { business_entity: '시목', limit: 1000 });
  return rows.map(p => ({
    id: p.id,
    workspaceId,
    name: p.name,
    sku: p.sku || undefined,
    category: p.category || undefined,
    status: (p.status === 'active' ? 'active' : 'draft') as Product['status'],
    price: p.price ?? undefined,
    cost: p.cost ?? undefined,        // 기준 원가(실매입가 아님). 마진은 근사 — 부가세(saleTaxType)는 후속 보정.
    stock: p.stock ?? undefined,
    imageUrl: p.imageUrl || undefined,
    description: undefined,
    tags: p.woodType ? [p.woodType] : undefined,
    updatedAt: p.updatedAt,
  }));
}

/** 워크스페이스 제품 목록 (최신순) — 소스 분기: 시목 API(조회) / Compatibility(수기) */
export async function fetchProducts(workspaceId: string, source: ErpSource = 'manual'): Promise<Product[]> {
  if (source === 'simok_api') return fetchProductsFromSimok(workspaceId);
  // Compatibility Mode: AI Office 임시 수기 입력분(Supabase)
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toProduct);
}

/** 쓰기(추가/수정/삭제)는 Compatibility Mode에서만 허용 — 외부 연동 시 System of Record는 시목앱. */
function assertWritable(source: ErpSource) {
  if (source === 'simok_api') throw new Error('외부 연동 모드에서는 제품을 AI Office에서 수정할 수 없어요. (System of Record = 시목앱)');
}

/** 제품 추가 (Compatibility Mode 전용) */
export async function addProduct(workspaceId: string, fields: Partial<Product>, source: ErpSource = 'manual'): Promise<Product> {
  assertWritable(source);
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('products')
    .insert({ workspace_id: workspaceId, created_by: userId, status: 'active', ...toRow(fields) })
    .select()
    .single();
  if (error) throw error;
  return toProduct(data);
}

/** 제품 수정 (Compatibility Mode 전용) */
export async function updateProduct(id: string, fields: Partial<Product>, source: ErpSource = 'manual'): Promise<void> {
  assertWritable(source);
  const { error } = await supabase
    .from('products')
    .update({ ...toRow(fields), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** 제품 삭제 (Compatibility Mode 전용) */
export async function deleteProduct(id: string, source: ErpSource = 'manual'): Promise<void> {
  assertWritable(source);
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}
