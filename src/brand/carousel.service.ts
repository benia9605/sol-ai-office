/**
 * @file src/brand/carousel.service.ts
 * @description 캐러셀 사진 고르기 (마이그 080) - 장마다 3안 · 고른 안 · 수정 요청 · 올린 사진
 *  - 본부가 hq_carousel_alts 로 3안을 넣고, 「선택 완료」(pick_status done) 를 hq_carousel_pull 로 가져가 확정본을 만든다
 *  - 080 표가 없으면 null 을 돌려 화면이 지금 모양 그대로 둔다
 */
import { supabase } from '../services/supabase';
import { getCurrentUserId } from '../services/auth';
import { hexToUrl, photoToHex } from './hq.service';

export interface Alt { slide: number; alt: number; url: string; changed: boolean }
export interface Pick { slide: number; alt: number; by?: string }
export interface PickRequest { id: string; slides: number[]; body: string; author?: string; at: string; image?: string; reply?: string; repliedAt?: string; resolved: boolean }
export interface Upload { id: string; slide?: number; url: string; by?: string; at: string }

const missing = (e: any) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === '42703' || /does not exist|schema cache/i.test(e.message ?? ''));

/** 멤버 이름 (workspace_members.nickname) */
async function names(ws: string): Promise<Record<string, string>> {
  const { data } = await supabase.from('workspace_members').select('user_id,nickname').eq('workspace_id', ws);
  return Object.fromEntries((data ?? []).map((m: any) => [m.user_id, m.nickname || '멤버']));
}

export async function getAlts(contentId: string): Promise<Alt[] | null> {
  const { data, error } = await supabase.from('hq_content_alts').select('slide_no,alt,mime,data,changed').eq('content_id', contentId).order('slide_no').order('alt');
  if (missing(error)) return null;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ slide: r.slide_no, alt: r.alt, url: hexToUrl(r), changed: !!r.changed }));
}

export async function getPicks(ws: string, contentId: string): Promise<Pick[]> {
  const { data, error } = await supabase.from('hq_content_picks').select('slide_no,alt,picked_by').eq('content_id', contentId);
  if (missing(error)) return [];
  if (error) throw error;
  const nm = await names(ws);
  return (data ?? []).map((r: any) => ({ slide: r.slide_no, alt: r.alt, by: r.picked_by ? nm[r.picked_by] : undefined }));
}

export async function setPick(ws: string, contentId: string, slide: number, alt: number): Promise<void> {
  const uid = await getCurrentUserId();
  const { error } = await supabase.from('hq_content_picks').upsert(
    { content_id: contentId, workspace_id: ws, slide_no: slide, alt, picked_by: uid, picked_at: new Date().toISOString() },
    { onConflict: 'content_id,slide_no' });
  if (error) throw error;
}

/** 선택 완료 → 본부가 몇 분 안에 확정본을 만든다 */
export async function completePick(contentId: string): Promise<void> {
  const { error } = await supabase.from('hq_contents').update({ pick_status: 'done', updated_at: new Date().toISOString() }).eq('id', contentId);
  if (error) throw error;
}

export async function listRequests(ws: string, contentId: string): Promise<PickRequest[] | null> {
  const { data, error } = await supabase.from('hq_content_requests')
    .select('id,slide_nos,body,author_id,image_mime,image_data,hq_reply,replied_at,resolved,created_at').eq('content_id', contentId).order('created_at');
  if (missing(error)) return null;
  if (error) throw error;
  const nm = await names(ws);
  return (data ?? []).map((r: any) => ({
    id: r.id, slides: r.slide_nos ?? [], body: r.body, author: r.author_id ? nm[r.author_id] : undefined, at: r.created_at,
    image: r.image_data ? hexToUrl({ mime: r.image_mime, data: r.image_data }) : undefined,
    reply: r.hq_reply ?? undefined, repliedAt: r.replied_at ?? undefined, resolved: !!r.resolved,
  }));
}

export async function addRequest(ws: string, contentId: string, slides: number[], body: string, image?: File): Promise<void> {
  const uid = await getCurrentUserId();
  const row: Record<string, unknown> = { content_id: contentId, workspace_id: ws, slide_nos: slides, body: body.trim(), author_id: uid };
  if (image) { row.image_mime = 'image/jpeg'; row.image_data = await photoToHex(image); }
  const { error } = await supabase.from('hq_content_requests').insert(row);
  if (error) throw error;
}

export async function listUploads(ws: string, contentId: string): Promise<Upload[] | null> {
  const { data, error } = await supabase.from('hq_content_uploads').select('id,slide_no,mime,data,uploaded_by,created_at').eq('content_id', contentId).order('created_at');
  if (missing(error)) return null;
  if (error) throw error;
  const nm = await names(ws);
  return (data ?? []).map((r: any) => ({ id: r.id, slide: r.slide_no ?? undefined, url: hexToUrl(r), by: r.uploaded_by ? nm[r.uploaded_by] : undefined, at: r.created_at }));
}

export async function addUploads(ws: string, contentId: string, slide: number | undefined, files: File[]): Promise<void> {
  const uid = await getCurrentUserId();
  const rows = [];
  for (const f of files.slice(0, 20)) rows.push({ content_id: contentId, workspace_id: ws, slide_no: slide ?? null, mime: 'image/jpeg', data: await photoToHex(f), uploaded_by: uid });
  if (!rows.length) return;
  const { error } = await supabase.from('hq_content_uploads').insert(rows);
  if (error) throw error;
}

/** 이미지 주문서(마크다운) → 주문 블록: 「## 주문」 제목 + 그 아래 첫 코드 블록(GPT 에 붙여 넣을 글) */
export interface OrderBlock { title: string; text: string; optional: boolean }
export function orderBlocks(md?: string): OrderBlock[] {
  if (!md) return [];
  const out: OrderBlock[] = [];
  const parts = md.split(/\n(?=##\s+주문)/);
  for (const p of parts) {
    const h = p.match(/^##\s+(주문[^\n]*)/);
    if (!h) continue;
    const code = p.match(/```[a-z]*\n([\s\S]*?)```/);
    if (!code) continue;
    out.push({ title: h[1].replace(/\s*\((GPT[^)]*|선택)\)/g, '').trim(), text: code[1].trim(), optional: /선택/.test(h[1]) });
  }
  return out;
}
