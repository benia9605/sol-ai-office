/**
 * @file src/services/attachments.service.ts
 * @description 첨부파일 서비스 (polymorphic) — 이식 킷 04
 * - 실 Supabase: 비공개 'attachments' 버킷 업로드 + attachments 테이블 행 (마이그 045)
 * - mock(로컬 dev): Storage가 없으므로 data URL을 in-memory 행에 저장해 미리보기
 * - 경로: {workspace_id}/{ref_type}/{ref_id}/{uuid}-{파일명}  (storage RLS가 workspace_id로 통제)
 */
import { supabase, isConfigured } from './supabase';
import { getCurrentUserId } from './auth';

const BUCKET = 'attachments';
const MAX_SIZE = 30 * 1024 * 1024; // 30MB

export type AttachmentRefType = 'task' | 'meeting' | 'insight' | 'record' | 'schedule';

export interface Attachment {
  id: string;
  workspaceId: string;
  refType: AttachmentRefType;
  refId: string;
  storagePath: string;
  filename: string;
  mime?: string;
  sizeBytes?: number;
  uploadedBy?: string;
  createdAt: string;
  /** mock/dev 전용 미리보기 data URL (실 모드에서는 signedUrl 사용) */
  dataUrl?: string;
}

function rowToAttachment(r: any): Attachment {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    refType: r.ref_type,
    refId: r.ref_id,
    storagePath: r.storage_path,
    filename: r.filename,
    mime: r.mime ?? undefined,
    sizeBytes: r.size_bytes ?? undefined,
    uploadedBy: r.uploaded_by ?? undefined,
    createdAt: r.created_at,
    dataUrl: r.data_url ?? undefined,
  };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** 대상(refType,refId)의 첨부 목록 (오래된 순) */
export async function listAttachments(refType: AttachmentRefType, refId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('ref_type', refType)
    .eq('ref_id', refId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToAttachment);
}

/** 파일명 안전화 — 경로/특수문자 제거, 길이 제한 */
function sanitizeName(name: string): string {
  return name.normalize('NFKD').replace(/[^\w.\-가-힣]+/g, '_').slice(-80) || 'file';
}

/** 파일 업로드 + attachments 행 생성. 행 생성 실패 시 올린 파일 롤백. */
export async function uploadAttachment(
  file: File,
  workspaceId: string,
  refType: AttachmentRefType,
  refId: string,
): Promise<Attachment> {
  if (file.size > MAX_SIZE) throw new Error('파일 크기가 30MB를 초과합니다.');
  const uid = await getCurrentUserId().catch(() => null);
  const path = `${workspaceId}/${refType}/${refId}/${crypto.randomUUID()}-${sanitizeName(file.name)}`;

  // ── mock/dev: Storage 없음 → data URL을 행에 저장 ──
  if (!isConfigured) {
    const dataUrl = await readAsDataUrl(file);
    const { data, error } = await supabase
      .from('attachments')
      .insert({
        workspace_id: workspaceId, ref_type: refType, ref_id: refId, storage_path: path,
        filename: file.name, mime: file.type || null, size_bytes: file.size, uploaded_by: uid,
        data_url: dataUrl,
      })
      .select().single();
    if (error) throw error;
    return rowToAttachment(data);
  }

  // ── 실 Supabase: 비공개 버킷 업로드 → 행 insert ──
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) throw new Error(`업로드 실패: ${upErr.message}`);

  const { data, error } = await supabase
    .from('attachments')
    .insert({
      workspace_id: workspaceId, ref_type: refType, ref_id: refId, storage_path: path,
      filename: file.name, mime: file.type || null, size_bytes: file.size, uploaded_by: uid,
    })
    .select().single();
  if (error) {
    // 행 생성 실패 → 방금 올린 파일 정리 (고아 방지)
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw error;
  }
  return rowToAttachment(data);
}

/** 첨부 삭제 (Storage 파일 → 행 순서) */
export async function deleteAttachment(a: Attachment): Promise<void> {
  if (isConfigured) {
    await supabase.storage.from(BUCKET).remove([a.storagePath]).catch(() => {});
  }
  const { error } = await supabase.from('attachments').delete().eq('id', a.id);
  if (error) throw error;
}

/** 비공개 파일 열람용 서명 URL (기본 1시간). mock에서는 저장된 data URL 반환. */
export async function signedUrl(a: Attachment, expiresIn = 3600): Promise<string | null> {
  if (!isConfigured) return a.dataUrl ?? null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.storagePath, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}
