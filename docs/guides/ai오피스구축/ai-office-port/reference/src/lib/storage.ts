import { isDemoMode } from "@/lib/demo/mode";
import { supabase } from "@/lib/supabase";
import { MOCK_ATTACHMENTS, MOCK_USER_PROFILES } from "@/lib/demo/fixtures";
import type { Attachment, AttachmentRefType } from "@/lib/types/database";

// ============================================================
// Avatars
// ============================================================

/**
 * Upload (or replace) the user's avatar.
 *
 * - Demo mode: read the file as a data URL and stamp it directly onto the
 *   in-memory profile. Persists only for the session.
 * - Real mode: upload to the `avatars/{user_id}/<random>.{ext}` path and
 *   return the resulting public URL.
 */
export async function uploadAvatar(
  userId: string,
  file: File,
): Promise<string | null> {
  if (isDemoMode()) {
    const dataUrl = await readFileAsDataURL(file);
    const i = MOCK_USER_PROFILES.findIndex((p) => p.user_id === userId);
    if (i >= 0) {
      MOCK_USER_PROFILES[i] = {
        ...MOCK_USER_PROFILES[i],
        avatar_url: dataUrl,
        updated_at: new Date().toISOString(),
      };
    }
    return dataUrl;
  }

  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase!.storage
    .from("avatars")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || undefined,
    });
  if (error) return null;

  const { data } = supabase!.storage.from("avatars").getPublicUrl(path);
  const url = data.publicUrl;
  // Persist on the profile so other UI components can read it.
  await supabase!
    .from("user_profiles")
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  return url;
}

// ============================================================
// Attachments
// ============================================================

export async function listAttachments(
  refType: AttachmentRefType,
  refId: string,
): Promise<Attachment[]> {
  if (isDemoMode()) {
    return MOCK_ATTACHMENTS.filter(
      (a) => a.ref_type === refType && a.ref_id === refId,
    ).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const { data } = await supabase!
    .from("attachments")
    .select("*")
    .eq("ref_type", refType)
    .eq("ref_id", refId)
    .order("created_at", { ascending: false });
  return (data as Attachment[]) ?? [];
}

export async function uploadAttachment({
  workspaceId,
  refType,
  refId,
  file,
  uploadedBy,
}: {
  workspaceId: string;
  refType: AttachmentRefType;
  refId: string;
  file: File;
  uploadedBy: string;
}): Promise<Attachment | null> {
  if (isDemoMode()) {
    const url = URL.createObjectURL(file);
    const row: Attachment = {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      ref_type: refType,
      ref_id: refId,
      storage_path: url, // demo: blob URL used directly as href
      filename: file.name,
      mime: file.type || null,
      size_bytes: file.size,
      uploaded_by: uploadedBy,
      created_at: new Date().toISOString(),
    };
    MOCK_ATTACHMENTS.unshift(row);
    return row;
  }

  const path = `${workspaceId}/${refType}/${refId}/${crypto.randomUUID()}-${sanitize(file.name)}`;
  const { error: uploadErr } = await supabase!.storage
    .from("attachments")
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
    });
  if (uploadErr) return null;

  const { data, error } = await supabase!
    .from("attachments")
    .insert({
      workspace_id: workspaceId,
      ref_type: refType,
      ref_id: refId,
      storage_path: path,
      filename: file.name,
      mime: file.type || null,
      size_bytes: file.size,
      uploaded_by: uploadedBy,
    })
    .select()
    .single();
  if (error || !data) {
    // best-effort cleanup
    await supabase!.storage.from("attachments").remove([path]);
    return null;
  }
  return data as Attachment;
}

export async function deleteAttachment(
  attachment: Attachment,
): Promise<boolean> {
  if (isDemoMode()) {
    const i = MOCK_ATTACHMENTS.findIndex((a) => a.id === attachment.id);
    if (i < 0) return false;
    MOCK_ATTACHMENTS.splice(i, 1);
    if (attachment.storage_path.startsWith("blob:")) {
      URL.revokeObjectURL(attachment.storage_path);
    }
    return true;
  }
  await supabase!.storage
    .from("attachments")
    .remove([attachment.storage_path]);
  const { error } = await supabase!
    .from("attachments")
    .delete()
    .eq("id", attachment.id);
  return !error;
}

/**
 * Resolve an attachment's storage path to a download URL.
 * - Demo mode: storage_path *is* the blob URL.
 * - Real mode: issue a 1-hour signed URL.
 */
export async function getAttachmentUrl(
  attachment: Attachment,
): Promise<string | null> {
  if (isDemoMode()) return attachment.storage_path;
  const { data } = await supabase!.storage
    .from("attachments")
    .createSignedUrl(attachment.storage_path, 3600);
  return data?.signedUrl ?? null;
}

// ============================================================
// Internal helpers
// ============================================================

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function sanitize(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 80);
}
