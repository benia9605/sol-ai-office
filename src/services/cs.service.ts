/**
 * @file src/services/cs.service.ts
 * @description CS 응대 — 문의 티켓 + FAQ 라이브러리 CRUD (마이그 034)
 * - 규칙 기반 분류(classifyTicket): 키워드로 유형·긴급도·감정·승인필요 자동 판정(API 키 불필요).
 * - 시목 FAQ Seed(원목·도마·가구·배송·재고·A/S) 일괄 등록.
 * - Mock 동기화: mockSupabase tickets / cs_faq.
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { Ticket, TicketCategory, TicketUrgency, TicketSentiment, CsFaq } from '../types';

interface TicketRow {
  id: string; workspace_id: string; channel: string; customer_name?: string; order_ref?: string;
  product_id?: string; original_text: string; category: string; urgency: string; sentiment: string;
  status: string; ai_draft?: string; final_answer?: string; needs_approval?: boolean; faq_candidate?: boolean;
  created_at?: string; updated_at?: string; answered_at?: string;
}
const toTicket = (r: TicketRow): Ticket => ({
  id: r.id, workspaceId: r.workspace_id, channel: (r.channel || 'other') as Ticket['channel'],
  customerName: r.customer_name, orderRef: r.order_ref, productId: r.product_id, originalText: r.original_text,
  category: (r.category || 'other') as TicketCategory, urgency: (r.urgency || 'normal') as TicketUrgency,
  sentiment: (r.sentiment || 'neutral') as TicketSentiment, status: (r.status || 'new') as Ticket['status'],
  aiDraft: r.ai_draft, finalAnswer: r.final_answer, needsApproval: !!r.needs_approval, faqCandidate: !!r.faq_candidate,
  createdAt: r.created_at, updatedAt: r.updated_at, answeredAt: r.answered_at,
});

/** 규칙 기반 분류 — 문의 원문 → 유형·긴급도·감정·승인필요 (API 키 없이) */
export function classifyTicket(text: string): { category: TicketCategory; urgency: TicketUrgency; sentiment: TicketSentiment; needsApproval: boolean } {
  const t = text.toLowerCase();
  const has = (...ks: string[]) => ks.some(k => t.includes(k));
  let category: TicketCategory = 'other';
  if (has('환불', '반품')) category = 'refund';
  else if (has('교환', '바꿔')) category = 'exchange';
  else if (has('파손', '깨', '부러', 'a/s', 'as ', '수리', '고장')) category = 'as';
  else if (has('배송', '언제', '도착', '택배', '발송', '제주', '도서산간')) category = 'shipping';
  else if (has('품절', '재입고', '입고', '재고', '예약')) category = 'stock';
  else if (has('오일', '세척', '관리', '갈라', '곰팡이', '칼자국', '냄새', '수평')) category = 'care';
  else if (has('색', '사이즈', '불량', '옹이', '나무결', '다른')) category = 'product';
  else if (has('주문', '결제')) category = 'order';

  let sentiment: TicketSentiment = 'neutral';
  if (has('최악', '화나', '실망', '짜증', '불량', '파손', '별로', '환불')) sentiment = 'negative';
  else if (has('감사', '좋아', '만족', '예뻐', '최고')) sentiment = 'positive';

  let urgency: TicketUrgency = 'normal';
  if (has('파손', '깨', '급', '당장', '최악', '화나', '법적')) urgency = 'critical';
  else if (category === 'refund' || category === 'exchange' || sentiment === 'negative') urgency = 'high';

  // 승인 필요: 환불·교환·A/S·부정감정·긴급
  const needsApproval = ['refund', 'exchange', 'as'].includes(category) || sentiment === 'negative' || urgency === 'critical';
  return { category, urgency, sentiment, needsApproval };
}

export async function fetchTickets(workspaceId: string): Promise<Ticket[]> {
  const { data, error } = await supabase.from('tickets').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toTicket);
}

export async function addTicket(workspaceId: string, fields: Partial<Ticket> & { originalText: string }): Promise<Ticket> {
  const userId = await getCurrentUserId().catch(() => null);
  const cls = classifyTicket(fields.originalText);
  const row = {
    workspace_id: workspaceId, created_by: userId,
    channel: fields.channel ?? 'other', customer_name: fields.customerName ?? null, order_ref: fields.orderRef ?? null,
    original_text: fields.originalText,
    category: fields.category ?? cls.category, urgency: fields.urgency ?? cls.urgency, sentiment: fields.sentiment ?? cls.sentiment,
    status: 'new', needs_approval: fields.needsApproval ?? cls.needsApproval, faq_candidate: false,
  };
  const { data, error } = await supabase.from('tickets').insert(row).select().single();
  if (error) throw error;
  return toTicket(data as TicketRow);
}

export async function updateTicket(id: string, fields: Partial<Ticket>): Promise<void> {
  const p: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.category !== undefined) p.category = fields.category;
  if (fields.urgency !== undefined) p.urgency = fields.urgency;
  if (fields.status !== undefined) { p.status = fields.status; if (fields.status === 'answered') p.answered_at = new Date().toISOString(); }
  if (fields.finalAnswer !== undefined) p.final_answer = fields.finalAnswer;
  if (fields.aiDraft !== undefined) p.ai_draft = fields.aiDraft;
  if (fields.faqCandidate !== undefined) p.faq_candidate = fields.faqCandidate;
  const { error } = await supabase.from('tickets').update(p).eq('id', id);
  if (error) throw error;
}

export async function deleteTicket(id: string): Promise<void> {
  const { error } = await supabase.from('tickets').delete().eq('id', id);
  if (error) throw error;
}

/* ── FAQ ── */
const toFaq = (r: any): CsFaq => ({ id: r.id, workspaceId: r.workspace_id, category: (r.category || 'other') as TicketCategory, question: r.question, answer: r.answer, occurrences: r.occurrences ?? 1, status: r.status, createdAt: r.created_at });

export async function fetchFaq(workspaceId: string): Promise<CsFaq[]> {
  const { data, error } = await supabase.from('cs_faq').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toFaq);
}

export async function addFaq(workspaceId: string, category: TicketCategory, question: string, answer?: string): Promise<void> {
  const userId = await getCurrentUserId().catch(() => null);
  const { error } = await supabase.from('cs_faq').insert({ workspace_id: workspaceId, created_by: userId, category, question, answer: answer ?? null, occurrences: 1, status: 'active' });
  if (error) throw error;
}

export async function deleteFaq(id: string): Promise<void> {
  const { error } = await supabase.from('cs_faq').delete().eq('id', id);
  if (error) throw error;
}

/** 시목 FAQ Seed — 원목·도마·가구·배송·재고·A/S 초기 등록 (GPT 제안) */
const SIMOK_FAQ_SEED: { category: TicketCategory; question: string }[] = [
  { category: 'product', question: '나무결·색상 차이가 불량인가요?' },
  { category: 'product', question: '사진과 색이 조금 다른데 정상인가요?' },
  { category: 'product', question: '작은 갈라짐·옹이는 문제인가요?' },
  { category: 'care', question: '도마 첫 사용 전 어떻게 세척하나요?' },
  { category: 'care', question: '오일링이 필요한가요? 얼마나 자주 하나요?' },
  { category: 'care', question: '식기세척기 사용 가능한가요?' },
  { category: 'care', question: '물에 담가도 되나요?' },
  { category: 'care', question: '냄새가 배었을 때 어떻게 하나요?' },
  { category: 'care', question: '곰팡이가 생기지 않게 관리하려면?' },
  { category: 'care', question: '칼자국은 어떻게 관리하나요?' },
  { category: 'product', question: '가구 조립이 필요한가요?' },
  { category: 'as', question: '수평이 조금 안 맞는데 어떻게 하나요?' },
  { category: 'shipping', question: '배송 기간은 얼마나 걸리나요?' },
  { category: 'shipping', question: '가구는 어떤 방식으로 배송되나요?' },
  { category: 'shipping', question: '제주·도서산간도 배송되나요?' },
  { category: 'shipping', question: '배송 중 파손 시 어떻게 처리되나요?' },
  { category: 'stock', question: '품절인데 언제 재입고되나요?' },
  { category: 'stock', question: '원하는 나무결을 지정할 수 있나요?' },
  { category: 'as', question: '파손·갈라짐 A/S 범위가 어떻게 되나요?' },
  { category: 'as', question: '오일링·샌딩 리터치가 가능한가요?' },
];

export async function seedSimokFaq(workspaceId: string): Promise<number> {
  const userId = await getCurrentUserId().catch(() => null);
  const existing = await fetchFaq(workspaceId).catch(() => [] as CsFaq[]);
  const existQ = new Set(existing.map(f => f.question));
  const toInsert = SIMOK_FAQ_SEED.filter(s => !existQ.has(s.question))
    .map(s => ({ workspace_id: workspaceId, created_by: userId, category: s.category, question: s.question, answer: null, occurrences: 1, status: 'active' }));
  if (toInsert.length === 0) return 0;
  const { error } = await supabase.from('cs_faq').insert(toInsert);
  if (error) throw error;
  return toInsert.length;
}
