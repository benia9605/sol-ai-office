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
  created_by: string;
  created_at: string;
}

function fromRow(r: WorkspaceRow): Workspace {
  return {
    id: r.id, name: r.name, emoji: r.emoji, color: r.color,
    imageUrl: r.image_url, bizInfo: r.biz_info,
    type: r.type, inviteCode: r.invite_code, credits: r.credits ?? undefined,
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
  fields: { name?: string; emoji?: string; imageUrl?: string; bizInfo?: string },
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (fields.name !== undefined) payload.name = fields.name.trim();
  if (fields.emoji !== undefined) payload.emoji = fields.emoji;
  if (fields.imageUrl !== undefined) payload.image_url = fields.imageUrl;
  if (fields.bizInfo !== undefined) payload.biz_info = fields.bizInfo;
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase.from('workspaces').update(payload).eq('id', id);
  if (error) throw error;
}

/** 워크스페이스 멤버 목록 (표시용 이름/이메일 조인) */
export async function fetchMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId);
  if (error) throw error;
  return (data ?? []).map((m: any) => ({
    workspaceId: m.workspace_id, userId: m.user_id, role: m.role,
    nickname: m.nickname, joinedAt: m.joined_at,
  }));
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

/** 초대 코드로 가입 */
export async function joinByInviteCode(code: string): Promise<Workspace> {
  const userId = await getCurrentUserId();
  const { data: ws, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('invite_code', code.trim().toUpperCase())
    .eq('type', 'office')
    .maybeSingle();
  if (error) throw error;
  if (!ws) throw new Error('초대 코드를 찾을 수 없어요');
  // 이미 멤버면 중복 추가하지 않고 그대로 반환 (기존 유저 재합류 안전)
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
}

/** 멤버 역할 변경 (owner ↔ member) */
export async function changeMemberRole(workspaceId: string, userId: string, role: 'owner' | 'member'): Promise<void> {
  const { error } = await supabase.from('workspace_members')
    .update({ role }).eq('workspace_id', workspaceId).eq('user_id', userId);
  if (error) throw error;
}
