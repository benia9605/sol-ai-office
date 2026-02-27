/**
 * @file src/services/storage.service.ts
 * @description Supabase Storage 이미지 업로드/삭제 서비스
 * - uploads 버킷 (public) 사용
 * - 폴더: projects/, readings/, notes/, sources/
 * - 최대 5MB, 허용: png, jpeg, webp, gif
 */
import { supabase } from './supabase';

const BUCKET = 'uploads';
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export type StorageFolder = 'projects' | 'readings' | 'notes' | 'sources';

/**
 * 이미지를 Supabase Storage에 업로드하고 public URL을 반환
 */
export async function uploadImage(file: File, folder: StorageFolder): Promise<string> {
  if (file.size > MAX_SIZE) {
    throw new Error('파일 크기가 5MB를 초과합니다.');
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('허용되지 않는 파일 형식입니다. (png, jpeg, webp, gif만 가능)');
  }

  const ext = file.name.split('.').pop() || 'png';
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, file, { contentType: file.type, upsert: false });

  if (error) throw new Error(`업로드 실패: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/**
 * Supabase Storage에서 이미지 삭제
 * @param url - getPublicUrl로 받은 전체 URL
 */
export async function deleteImage(url: string): Promise<void> {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return; // Storage URL이 아니면 무시

  const filePath = url.slice(idx + marker.length);

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([filePath]);

  if (error) throw new Error(`삭제 실패: ${error.message}`);
}
