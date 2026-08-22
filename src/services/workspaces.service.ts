/**
 * @file src/services/workspaces.service.ts
 * @description 공유 워크스페이스 CRUD 서비스 (빌드 A)
 * - workspaces / workspace_members / workspace_invites 연동
 * - DB 컬럼(snake_case) ↔ 프론트(camelCase) 변환
 * - 확정설계: docs/guides/ai오피스구축/_공유워크스페이스_확정설계.md
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { Workspace, WorkspaceMember, WorkspaceInvite, WorkspaceType } from '../types';

export interface WorkspaceRow {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
  image_url?: string;
  biz_info?: string;
  type: 'personal' | 'office';
  invite_code?: string;
  credits?: number;
  erp_source?: string;
  monthly_sales_target?: number;
  created_by: string;
  created_at: string;
}

function fromRow(r: WorkspaceRow): Workspace {
  return {
    id: r.id, name: r.name, emoji: r.emoji, color: r.color,
    imageUrl: r.image_url, bizInfo: r.biz_info,
    type: r.type, inviteCode: r.invite_code, credits: r.credits ?? undefined,
    erpSource: r.erp_source === 'simok_api' ? 'simok_api' : 'manual',
    monthlySalesTarget: r.monthly_sales_target ?? undefined,
    createdBy: r.created_by, createdAt: r.created_at,
  };
}

/** 6자리 초대 코드 생성 */
function genInviteCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** 내가 속한 모든 워크스페이스 (개인 + 팀) */
export async function fetchMyWorkspaces(): Promise<Workspace[]> {
  const userId = await getCurrentUserId();
  // 내 멤버십 → 워크스페이스 id
  const { data: members, error: mErr } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId);
  if (mErr) throw mErr;
  const ids = (members ?? []).map((m: { workspace_id: string }) => m.workspace_id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .in('id', ids)
    .order('type', { ascending: true })   // personal 먼저
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

/** 내 개인 워크스페이스 (없으면 생성) */
export async function ensurePersonalWorkspace(): Promise<Workspace> {
  const userId = await getCurrentUserId();
  const { data } = await supabase
    .from('workspaces')
    .select('*')
    .eq('created_by', userId)
    .eq('type', 'personal')
    .maybeSingle();
  if (data) return fromRow(data);

  // 트리거가 없거나 mock 모드일 때 보조 생성
  const { data: created, error } = await supabase
    .from('workspaces')
    .insert({ name: '내 오피스', emoji: '👤', type: 'personal', created_by: userId })
    .select()
    .single();
  if (error) throw error;
  await supabase.from('workspace_members')
    .insert({ workspace_id: created.id, user_id: userId, role: 'owner' });
  return fromRow(created);
}

/**
 * 워크스페이스 생성 (개인 공간 또는 회사 오피스) + 본인 owner 등록
 * - office면 초대 코드 자동 생성
 */
export async function createWorkspace(
  type: WorkspaceType,
  name: string,
  opts?: { emoji?: string; color?: string; imageUrl?: string; bizInfo?: string },
): Promise<Workspace> {
  const userId = await getCurrentUserId();
  const payload: Record<string, unknown> = {
    name: name.trim(),
    emoji: opts?.emoji || (type === 'office' ? '🏢' : '👤'),
    type,
    created_by: userId,
  };
  if (opts?.color) payload.color = opts.color;
  if (opts?.imageUrl) payload.image_url = opts.imageUrl;
  if (opts?.bizInfo) payload.biz_info = opts.bizInfo;
  if (type === 'office') payload.invite_code = genInviteCode();

  const { data, error } = await supabase
    .from('workspaces')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  await supabase.from('workspace_members')
    .insert({ workspace_id: data.id, user_id: userId, role: 'owner' });
  return fromRow(data);
}

/** 워크스페이스 정보 수정 (이름/이모지/이미지/사업정보) */
export async function updateWorkspace(
  id: string,
  fields: { name?: string; emoji?: string; imageUrl?: string; bizInfo?: string; monthlySalesTarget?: number | null },
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (fields.name !== undefined) payload.name = fields.name.trim();
  if (fields.emoji !== undefined) payload.emoji = fields.emoji;
  if (fields.imageUrl !== undefined) payload.image_url = fields.imageUrl;
  if (fields.bizInfo !== undefined) payload.biz_info = fields.bizInfo;
  if (fields.monthlySalesTarget !== undefined) payload.monthly_sales_target = fields.monthlySalesTarget;
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase.from('workspaces').update(payload).eq('id', id);
  if (error) throw error;
}

// 멤버 목록 캐시 — 화면 전환(list↔detail)마다 재조회하던 것을 줄인다. 멤버는 자주 안 바뀜.
const _memberCache = new Map<string, { at: number; data: WorkspaceMember[] }>();
const _MEMBER_TTL = 30000; // 30초
/** 멤버 캐시 무효화 (멤버 변경 시). ws 없으면 전체 비움. */
export function invalidateMembers(workspaceId?: string) {
  if (workspaceId) _memberCache.delete(workspaceId); else _memberCache.clear();
}

/** 워크스페이스 멤버 목록 (30초 캐시). fresh:true면 캐시 무시. */
export async function fetchMembers(workspaceId: string, opts?: { fresh?: boolean }): Promise<WorkspaceMember[]> {
  const cached = _memberCache.get(workspaceId);
  if (!opts?.fresh && cached && (performance.now() - cached.at) < _MEMBER_TTL) return cached.data;
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .limit(200);
  if (error) throw error;
  const mapped: WorkspaceMember[] = (data ?? []).map((m: any) => ({
    workspaceId: m.workspace_id, userId: m.user_id, role: m.role,
    nickname: m.nickname, avatarUrl: m.avatar_url ?? undefined, joinedAt: m.joined_at,
  }));
  _memberCache.set(workspaceId, { at: performance.now(), data: mapped });
  return mapped;
}

/** 내 프로필(이름·이미지)을 내 모든 워크스페이스 멤버 행에 동기화 — '나' 저장 시 호출 */
export async function updateMyMemberProfile(fields: { nickname?: string; avatarUrl?: string | null }): Promise<void> {
  const { getCurrentUserId } = await import('./auth');
  const uid = await getCurrentUserId().catch(() => null);
  if (!uid) return;
  const payload: Record<string, unknown> = {};
  if (fields.nickname !== undefined) payload.nickname = fields.nickname;
  if (fields.avatarUrl !== undefined) payload.avatar_url = fields.avatarUrl || null;
  if (Object.keys(payload).length === 0) return;
  await supabase.from('workspace_members').update(payload).eq('user_id', uid);
  invalidateMembers(); // 이름·이미지 바뀜 → 전 워크스페이스 캐시 갱신
}

/** 이메일로 초대 (pending) — 가입/수락은 별도(빌드 C) */
export async function inviteByEmail(workspaceId: string, email: string): Promise<WorkspaceInvite> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('workspace_invites')
    .insert({ workspace_id: workspaceId, email: email.trim().toLowerCase(), invited_by: userId, status: 'pending' })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id, workspaceId: data.workspace_id, email: data.email,
    invitedBy: data.invited_by, status: data.status, createdAt: data.created_at,
  };
}

/**
 * 초대 코드로 가입
 * - 1차: RPC join_office_by_code (RLS 우회 — 멤버 아닌 사람도 코드로 조회+가입)
 * - 2차 폴백: 직접 조회 (mock 모드 / RPC 미배포 환경, 또는 이미 멤버인 경우)
 */
export async function joinByInviteCode(code: string): Promise<Workspace> {
  const norm = code.trim().toUpperCase();
  const userId = await getCurrentUserId();

  // 1) RPC (권장 경로)
  const { data: rpcData, error: rpcErr } = await supabase.rpc('join_office_by_code', { p_code: norm });
  if (!rpcErr && rpcData) {
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (row?.id) return fromRow(row);
  }

  // 2) 폴백: 직접 조회 (mock/사전배포/기존 멤버)
  const { data: ws } = await supabase
    .from('workspaces')
    .select('*')
    .eq('invite_code', norm)
    .eq('type', 'office')
    .maybeSingle();
  if (!ws) throw new Error('초대 코드를 찾을 수 없어요');

  const { data: existing } = await supabase.from('workspace_members')
    .select('user_id').eq('workspace_id', ws.id).eq('user_id', userId).maybeSingle();
  if (!existing) {
    await supabase.from('workspace_members')
      .insert({ workspace_id: ws.id, user_id: userId, role: 'member' });
  }
  return fromRow(ws);
}

/** 멤버 추방 (오너만) */
export async function removeMember(workspaceId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('workspace_members')
    .delete().eq('workspace_id', workspaceId).eq('user_id', userId);
  if (error) throw error;
  invalidateMembers(workspaceId);
}

/** 멤버 역할 변경 (owner ↔ member) */
export async function changeMemberRole(workspaceId: string, userId: string, role: 'owner' | 'member'): Promise<void> {
  const { error } = await supabase.from('workspace_members')
    .update({ role }).eq('workspace_id', workspaceId).eq('user_id', userId);
  if (error) throw error;
  invalidateMembers(workspaceId);
}

/** 멤버 닉네임(표시 이름) 변경 — 본인 것(또는 오너가 타인 것) */
export async function updateMemberNickname(workspaceId: string, userId: string, nickname: string): Promise<void> {
  const { error } = await supabase.from('workspace_members')
    .update({ nickname: nickname.trim() || null }).eq('workspace_id', workspaceId).eq('user_id', userId);
  if (error) throw error;
  invalidateMembers(workspaceId);
}
