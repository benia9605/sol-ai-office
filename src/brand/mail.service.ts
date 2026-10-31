/**
 * @file src/brand/mail.service.ts
 * @description 10 메일 - 본부(sol-hq)가 계정마다 IMAP 으로 읽어 정리한 것 (마이그 076)
 *
 * 본부는 매일 10시 · 중요 메일은 바로 hq_mail_push 로 요약 · 분류 · 초안을 넣는다. 메일 본문 전체는 오지 않는다.
 * 사람은 여기서 초안을 고치고 「보내기 확정」 → 본부가 몇 분 안에 hq_mail_pull 로 가져가 그 계정으로 보낸다.
 * 권한은 RLS(워크스페이스 멤버) - 이 파일은 workspace_id 로 거르기만 한다.
 */
import { supabase } from '../services/supabase';
import { getCurrentUserId } from '../services/auth';
import { hexToUrl, photoToHex } from './hq.service';

export type MailCategory = 'important' | 'reply' | 'order' | 'billing' | 'ad' | 'notice' | 'other';
export const MAIL_CATS: { key: MailCategory; label: string }[] = [
  { key: 'important', label: '중요' }, { key: 'reply', label: '답장 필요' }, { key: 'order', label: '주문 · 결제' },
  { key: 'billing', label: '청구서 · 구독 결제' }, { key: 'ad', label: '광고' }, { key: 'notice', label: '알림' }, { key: 'other', label: '기타' },
];
export const catLabel = (k: string) => MAIL_CATS.find(c => c.key === k)?.label ?? k;

export interface MailAccount { id: string; address: string; provider: string; label?: string; lastSyncAt?: string; lastError?: string }
export interface MailMessage {
  id: string; accountId?: string; msgKey: string; fromName?: string; fromAddr?: string; subject?: string; summary?: string;
  category: MailCategory; status: 'open' | 'done' | 'trashed' | 'archived'; isRead: boolean; receivedAt: string;
}
export interface MailDigest { day: string; periodFrom: string; periodTo: string; counts: Record<string, number>; trashed: number; readMarked: number; drafted: number; unsubFound: number; note?: string }
export type DraftStatus = 'draft' | 'confirmed' | 'sending' | 'sent' | 'failed' | 'discarded';
export interface MailDraft {
  id: string; accountId?: string; messageId?: string; toAddr: string; cc?: string; subject: string; html: string;
  signatureId?: string; templateId?: string; basis?: string; status: DraftStatus; hq: boolean;
  confirmedAt?: string; sentAt?: string; error?: string; editedAt?: string; createdAt: string; updatedAt: string;
}
export interface MailTemplate { id: string; name: string; whenToUse?: string; subject?: string; html: string; useCount: number; proposed: boolean; sort: number }
export interface MailSignature { id: string; accountId?: string; name: string; html: string; hasCard: boolean; cardMime?: string; isDefault: boolean }
export type UnsubMethod = 'oneclick' | 'link' | 'caution' | 'filter';
export interface MailUnsub {
  id: string; accountId?: string; senderName?: string; senderAddr: string; count30d: number; method: UnsubMethod;
  status: 'candidate' | 'requested' | 'done' | 'failed' | 'kept'; note?: string; requestedAt?: string; doneAt?: string;
  /** 그동안 온 메일 (본부가 넣음 · 077) - 날짜 · 제목 */
  examples: { date: string; subject: string }[];
  /** 유지 메모 (078 · 칼럼이 없으면 undefined) */
  keepMemo?: string | null;
}
export const UNSUB_METHOD: Record<UnsubMethod, string> = { oneclick: '원클릭 취소', link: '링크 열어 취소', caution: '주의', filter: '자동 보관 필터' };

const now = () => new Date().toISOString();

// ── 기간 (KST · 기준 10시) ──
const KST = 9 * 3600e3;
/** KST 날짜 YYYY-MM-DD 의 hh:00 → ISO */
export function kstAt(day: string, hour = 0): string { return new Date(Date.parse(`${day}T00:00:00Z`) - KST + hour * 3600e3).toISOString(); }
export function kstDay(offset = 0): string { return new Date(Date.now() + KST + offset * 86400e3).toISOString().slice(0, 10); }
export type QuickRange = 'today' | 'yesterday' | 'week' | 'd7' | 'd30' | 'month' | 'custom';
export const QUICK: { key: QuickRange; label: string }[] = [
  { key: 'today', label: '오늘' }, { key: 'yesterday', label: '어제' }, { key: 'week', label: '이번 주' },
  { key: 'd7', label: '7일' }, { key: 'd30', label: '30일' }, { key: 'month', label: '이번 달' },
];
export interface Range { key: QuickRange; from: string; to: string; day?: string }
/** 「오늘」 = 어제 10:00 ~ 오늘 10:00 (아침 정리 기준) */
export function quickRange(key: QuickRange, custom?: { from: string; to: string }): Range {
  const t = kstDay(), y = kstDay(-1);
  switch (key) {
    case 'today': return { key, from: kstAt(y, 10), to: kstAt(t, 10), day: t };
    case 'yesterday': return { key, from: kstAt(kstDay(-2), 10), to: kstAt(y, 10), day: y };
    case 'week': { const wd = (new Date(Date.parse(`${t}T00:00:00Z`)).getUTCDay() + 6) % 7; return { key, from: kstAt(kstDay(-wd)), to: now() }; }
    case 'd7': return { key, from: new Date(Date.now() - 7 * 86400e3).toISOString(), to: now() };
    case 'd30': return { key, from: new Date(Date.now() - 30 * 86400e3).toISOString(), to: now() };
    case 'month': return { key, from: kstAt(`${t.slice(0, 8)}01`), to: now() };
    case 'custom': return { key, from: kstAt(custom?.from ?? y), to: kstAt(custom?.to ?? t, 24) };
  }
}
/** 10.30 (금) 10:00 */
export function fmtKst(iso: string): string {
  const d = new Date(Date.parse(iso) + KST);
  const w = '일월화수목금토'[d.getUTCDay()];
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')} (${w}) ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
/** 목록 오른쪽 시간 - 오늘이면 09:12 · 어제 · 10.29 */
export function fmtWhen(iso: string): string {
  const d = new Date(Date.parse(iso) + KST), day = d.toISOString().slice(0, 10);
  if (day === kstDay()) return d.toISOString().slice(11, 16);
  if (day === kstDay(-1)) return '어제';
  return `${day.slice(5, 7)}.${day.slice(8, 10)}`;
}

// ── 읽기 ──
export async function listMailAccounts(ws: string): Promise<MailAccount[]> {
  const { data, error } = await supabase.from('hq_mail_accounts').select('id,address,provider,label,last_sync_at,last_error')
    .eq('workspace_id', ws).eq('is_active', true).order('created_at');
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, address: r.address, provider: r.provider, label: r.label ?? undefined, lastSyncAt: r.last_sync_at ?? undefined, lastError: r.last_error ?? undefined }));
}
function rowMsg(r: any): MailMessage {
  return { id: r.id, accountId: r.account_id ?? undefined, msgKey: r.msg_key, fromName: r.from_name ?? undefined, fromAddr: r.from_addr ?? undefined,
    subject: r.subject ?? undefined, summary: r.summary ?? undefined, category: r.category, status: r.status, isRead: !!r.is_read, receivedAt: r.received_at };
}
const MSG_COLS = 'id,account_id,msg_key,from_name,from_addr,subject,summary,category,status,is_read,received_at';
/** 기간 안 메일 (휴지통 제외) */
export async function listMailMessages(ws: string, from: string, to: string): Promise<MailMessage[]> {
  const { data, error } = await supabase.from('hq_mail_messages').select(MSG_COLS)
    .eq('workspace_id', ws).gte('received_at', from).lt('received_at', to).neq('status', 'trashed')
    .order('received_at', { ascending: false }).limit(1000);
  if (error) throw error;
  return (data ?? []).map(rowMsg);
}
/** 본문 미리보기 (079 · 칼럼이 없으면 null - 화면에서 숨김) */
export async function getMailExcerpt(id: string): Promise<string | null> {
  const { data, error } = await supabase.from('hq_mail_messages').select('excerpt').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return (data as { excerpt?: string | null }).excerpt || null;
}
/** 아직 남은 것 - 기간과 상관없이 답장 필요 · 중요 중 안 끝낸 것 */
export async function listOpenMail(ws: string): Promise<MailMessage[]> {
  const { data, error } = await supabase.from('hq_mail_messages').select(MSG_COLS)
    .eq('workspace_id', ws).eq('status', 'open').in('category', ['reply', 'important'])
    .order('received_at', { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []).map(rowMsg);
}
export async function getMailDigest(ws: string, day: string): Promise<MailDigest | null> {
  const { data, error } = await supabase.from('hq_mail_digests').select('*').eq('workspace_id', ws).eq('day', day).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { day: data.day, periodFrom: data.period_from, periodTo: data.period_to, counts: data.counts ?? {}, trashed: data.trashed ?? 0,
    readMarked: data.read_marked ?? 0, drafted: data.drafted ?? 0, unsubFound: data.unsub_found ?? 0, note: data.note ?? undefined };
}
export async function setMailDone(id: string, done = true): Promise<void> {
  const uid = await getCurrentUserId();
  const { error } = await supabase.from('hq_mail_messages').update({ status: done ? 'done' : 'open', done_by: done ? uid : null, updated_at: now() }).eq('id', id);
  if (error) throw error;
}

// ── 초안 ──
function rowDraft(r: any): MailDraft {
  return { id: r.id, accountId: r.account_id ?? undefined, messageId: r.message_id ?? undefined, toAddr: r.to_addr ?? '', cc: r.cc ?? undefined,
    subject: r.subject ?? '', html: r.html ?? '', signatureId: r.signature_id ?? undefined, templateId: r.template_id ?? undefined, basis: r.basis ?? undefined,
    status: r.status, hq: !!r.hq_key, confirmedAt: r.confirmed_at ?? undefined, sentAt: r.sent_at ?? undefined, error: r.error ?? undefined,
    editedAt: r.edited_at ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at };
}
export async function listDrafts(ws: string): Promise<MailDraft[]> {
  const { data, error } = await supabase.from('hq_mail_drafts').select('*').eq('workspace_id', ws).neq('status', 'discarded')
    .order('updated_at', { ascending: false }).limit(300);
  if (error) throw error;
  return (data ?? []).map(rowDraft);
}
export interface DraftFields { accountId?: string; toAddr: string; cc?: string; subject: string; html: string; signatureId?: string; templateId?: string }
const draftRow = (f: DraftFields) => ({ account_id: f.accountId || null, to_addr: f.toAddr, cc: f.cc || null, subject: f.subject, html: f.html,
  signature_id: f.signatureId || null, template_id: f.templateId || null });
export async function addDraft(ws: string, f: DraftFields, messageId?: string): Promise<MailDraft> {
  const { data, error } = await supabase.from('hq_mail_drafts').insert({ workspace_id: ws, message_id: messageId || null, ...draftRow(f), edited_at: now() }).select('*').single();
  if (error) throw error;
  return rowDraft(data);
}
/** 사람이 고침 → edited_at (본부가 다시 덮지 않는다) */
export async function saveDraft(id: string, f: DraftFields): Promise<void> {
  const { error } = await supabase.from('hq_mail_drafts').update({ ...draftRow(f), edited_at: now(), updated_at: now() }).eq('id', id);
  if (error) throw error;
}
export async function confirmDraft(id: string, f: DraftFields): Promise<void> {
  const uid = await getCurrentUserId();
  const { error } = await supabase.from('hq_mail_drafts').update({ ...draftRow(f), edited_at: now(), status: 'confirmed', confirmed_by: uid, confirmed_at: now(), error: null, updated_at: now() }).eq('id', id);
  if (error) throw error;
}
/** 본부가 아직 안 가져간 확정만 되돌린다 */
export async function unconfirmDraft(id: string): Promise<void> {
  const { error } = await supabase.from('hq_mail_drafts').update({ status: 'draft', confirmed_by: null, confirmed_at: null, updated_at: now() }).eq('id', id).eq('status', 'confirmed');
  if (error) throw error;
}
export async function discardDraft(id: string): Promise<void> {
  const { error } = await supabase.from('hq_mail_drafts').update({ status: 'discarded', updated_at: now() }).eq('id', id);
  if (error) throw error;
}

// ── 템플릿 ──
export async function listTemplates(ws: string): Promise<MailTemplate[]> {
  const { data, error } = await supabase.from('hq_mail_templates').select('*').eq('workspace_id', ws).order('proposed').order('sort').order('name');
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, name: r.name, whenToUse: r.when_to_use ?? undefined, subject: r.subject ?? undefined, html: r.html ?? '',
    useCount: r.use_count ?? 0, proposed: !!r.proposed, sort: r.sort ?? 0 }));
}
export interface TemplateFields { name: string; whenToUse?: string; subject?: string; html: string }
export async function saveTemplate(ws: string, id: string | undefined, f: TemplateFields): Promise<void> {
  const row = { name: f.name, when_to_use: f.whenToUse || null, subject: f.subject || null, html: f.html, proposed: false, updated_at: now() };
  const { error } = id ? await supabase.from('hq_mail_templates').update(row).eq('id', id) : await supabase.from('hq_mail_templates').insert({ workspace_id: ws, ...row });
  if (error) throw error;
}
export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('hq_mail_templates').delete().eq('id', id);
  if (error) throw error;
}
export async function bumpTemplate(t: MailTemplate): Promise<void> {
  await supabase.from('hq_mail_templates').update({ use_count: t.useCount + 1 }).eq('id', t.id);
}

// ── 서명 (늘 본문 아래 구분선 뒤 · 명함 이미지) ──
export async function listSignatures(ws: string): Promise<MailSignature[]> {
  // 이미지 유무는 card_mime 로 (이미지 bytea 는 열 때만 받는다)
  const { data, error } = await supabase.from('hq_mail_signatures').select('id,account_id,name,html,card_mime,is_default')
    .eq('workspace_id', ws).order('is_default', { ascending: false }).order('created_at');
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, accountId: r.account_id ?? undefined, name: r.name, html: r.html ?? '', hasCard: !!r.card_mime, cardMime: r.card_mime ?? undefined, isDefault: !!r.is_default }));
}
const cardCache = new Map<string, string | null>();
export async function getSignatureCard(id: string): Promise<string | null> {
  if (cardCache.has(id)) return cardCache.get(id)!;
  const { data } = await supabase.from('hq_mail_signatures').select('card_mime,card_data').eq('id', id).maybeSingle();
  const url = data?.card_data ? hexToUrl({ mime: data.card_mime, data: data.card_data }) : null;
  cardCache.set(id, url);
  return url;
}
export interface SignatureFields { name: string; html: string; accountId?: string; isDefault: boolean; card?: File | null; removeCard?: boolean }
export async function saveSignature(ws: string, id: string | undefined, f: SignatureFields): Promise<void> {
  const row: Record<string, unknown> = { name: f.name, html: f.html, account_id: f.accountId || null, is_default: f.isDefault, updated_at: now() };
  if (f.card) { row.card_mime = 'image/jpeg'; row.card_data = await photoToHex(f.card); }
  else if (f.removeCard) { row.card_mime = null; row.card_data = null; }
  if (f.isDefault) {
    // 기본 서명은 (같은 계정 범위에서) 하나만
    let q = supabase.from('hq_mail_signatures').update({ is_default: false }).eq('workspace_id', ws);
    q = f.accountId ? q.eq('account_id', f.accountId) : q.is('account_id', null);
    await q;
  }
  const { error } = id ? await supabase.from('hq_mail_signatures').update(row).eq('id', id) : await supabase.from('hq_mail_signatures').insert({ workspace_id: ws, ...row });
  if (error) throw error;
  if (id) cardCache.delete(id);
}
export async function deleteSignature(id: string): Promise<void> {
  const { error } = await supabase.from('hq_mail_signatures').delete().eq('id', id);
  if (error) throw error;
}

// ── 구독 취소 ──
export async function listUnsubs(ws: string): Promise<MailUnsub[]> {
  const { data, error } = await supabase.from('hq_mail_unsubs').select('*').eq('workspace_id', ws).order('count_30d', { ascending: false }).limit(300);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, accountId: r.account_id ?? undefined, senderName: r.sender_name ?? undefined, senderAddr: r.sender_addr,
    count30d: r.count_30d ?? 0, method: r.method, status: r.status, note: r.note ?? undefined, requestedAt: r.requested_at ?? undefined, doneAt: r.done_at ?? undefined,
    examples: exList(r.examples), keepMemo: 'keep_memo' in r ? (r.keep_memo ?? null) : undefined }));
}
const exList = (v: unknown) => Array.isArray(v) ? v.filter((x: any) => x && x.subject).map((x: any) => ({ date: String(x.date ?? ''), subject: String(x.subject) })) : [];
export async function requestUnsubs(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const uid = await getCurrentUserId();
  const { error } = await supabase.from('hq_mail_unsubs').update({ status: 'requested', requested_by: uid, requested_at: now(), updated_at: now() }).in('id', ids).eq('status', 'candidate');
  if (error) throw error;
}
/** 유지 - 다음 날 본부가 읽어 「지키기」 에 넣는다 (hq_mail_pull kept · 077) · 메모는 078 (메모에 「배움」 → 본부 배움 라벨) */
export async function keepUnsub(id: string, memo?: string | null): Promise<void> {
  const row: Record<string, unknown> = { status: 'kept', updated_at: now() };
  if (memo !== undefined) row.keep_memo = memo?.trim() || null;
  const { error } = await supabase.from('hq_mail_unsubs').update(row).eq('id', id);
  if (error) throw error;
}
export async function setUnsubMemo(id: string, memo: string): Promise<void> {
  const { error } = await supabase.from('hq_mail_unsubs').update({ keep_memo: memo.trim() || null, updated_at: now() }).eq('id', id);
  if (error) throw error;
}
/** 유지 되돌리기 - 다시 구독 취소 대상으로 */
export async function unkeepUnsub(id: string): Promise<void> {
  const { error } = await supabase.from('hq_mail_unsubs').update({ status: 'candidate', updated_at: now() }).eq('id', id).eq('status', 'kept');
  if (error) throw error;
}

// ── 메일함 정리 (077) ── 본부가 보낸 곳별 정리안을 넣고, 사람이 고른 뒤 「정리 요청」 → 본부가 몇 분 안에 실행
export type CleanAction = 'trash' | 'unsub_trash' | 'label' | 'keep' | 'ask';
export interface MailCleanup {
  id: string; accountId?: string; senderAddr: string; senderName?: string; part: string; kind: string;
  action: CleanAction; label?: string; chosen?: Exclude<CleanAction, 'ask'>; checked: boolean;
  count: number; unseen: number; goneMonths?: number; newest?: string; examples: { date: string; subject: string }[]; note?: string;
  status: 'proposed' | 'requested' | 'done' | 'failed'; moved: number; unsubOk?: boolean; error?: string; keepMemo?: string | null;
}
/** 실제로 할 일 = 사람이 고른 것 먼저 */
export const cleanDo = (c: MailCleanup): CleanAction => c.chosen ?? c.action;
export const CLEAN_LABEL: Record<CleanAction, string> = { trash: '휴지통', unsub_trash: '구독 취소 + 휴지통', label: '라벨', keep: '유지', ask: '확인 필요' };
export async function listCleanup(ws: string): Promise<MailCleanup[]> {
  const { data, error } = await supabase.from('hq_mail_cleanup').select('*').eq('workspace_id', ws).order('count', { ascending: false }).limit(2000);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, accountId: r.account_id ?? undefined, senderAddr: r.sender_addr, senderName: r.sender_name ?? undefined,
    part: r.part, kind: r.kind, action: r.action, label: r.label ?? undefined, chosen: r.chosen ?? undefined, checked: !!r.checked,
    count: r.count ?? 0, unseen: r.unseen ?? 0, goneMonths: r.gone_months ?? undefined, newest: r.newest ?? undefined, examples: exList(r.examples),
    note: r.note ?? undefined, status: r.status, moved: r.moved ?? 0, unsubOk: r.unsub_ok ?? undefined, error: r.error ?? undefined,
    keepMemo: 'keep_memo' in r ? (r.keep_memo ?? null) : undefined }));
}
/** 행동 바꾸기 · 체크 · 유지 메모 */
export async function setCleanup(id: string, f: { chosen?: Exclude<CleanAction, 'ask'> | null; checked?: boolean; keepMemo?: string | null }): Promise<void> {
  const row: Record<string, unknown> = { updated_at: now() };
  if (f.chosen !== undefined) row.chosen = f.chosen;
  if (f.checked !== undefined) row.checked = f.checked;
  if (f.keepMemo !== undefined) row.keep_memo = f.keepMemo?.trim() || null;
  const { error } = await supabase.from('hq_mail_cleanup').update(row).eq('id', id);
  if (error) throw error;
}
/** 정리 요청 - 체크한 줄 중 휴지통 · 구독 취소 · 라벨만 (유지는 다음 정리에 반영) */
export async function requestCleanup(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const uid = await getCurrentUserId();
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase.from('hq_mail_cleanup').update({ status: 'requested', checked: true, requested_by: uid, requested_at: now(), error: null, updated_at: now() })
      .in('id', ids.slice(i, i + 200)).in('status', ['proposed', 'failed']);
    if (error) throw error;
  }
}

/** 받는 사람 화면 - 본문 + 구분선 + 서명(명함) · 손님 메일 앱처럼 */
export function composeHtml(body: string, sig?: { html: string } | null, cardUrl?: string | null): string {
  const s = sig ? `<hr style="border:0;border-top:1px solid #dcdcd2;margin:24px 0 16px">${cardUrl ? `<img src="${cardUrl}" alt="명함" style="max-width:260px;border-radius:8px;display:block;margin-bottom:10px">` : ''}${sig.html}` : '';
  return `${body}${s}`;
}
