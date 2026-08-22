import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAsync } from "@/lib/use-async";
import {
  deleteAttachment,
  listAttachments,
  uploadAttachment,
} from "@/lib/storage";
import { AttachmentViewer } from "./attachment-viewer";
import type { Attachment, AttachmentRefType } from "@/lib/types/database";

type Props = {
  workspaceId: string;
  refType: AttachmentRefType;
  refId: string;
  /** Workspace admin / item creator. Controls upload + delete affordance. */
  canManage: boolean;
};

export function AttachmentsSection({
  workspaceId,
  refType,
  refId,
  canManage,
}: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewing, setViewing] = useState<Attachment | null>(null);

  const { data: items, loading } = useAsync(
    () => listAttachments(refType, refId),
    [refType, refId, refreshKey],
  );

  async function handlePick() {
    fileRef.current?.click();
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 20 * 1024 * 1024) {
      setError("20MB 이하 파일만 가능해요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const row = await uploadAttachment({
        workspaceId,
        refType,
        refId,
        file,
        uploadedBy: user.id,
      });
      if (!row) {
        setError("업로드에 실패했어요.");
      } else {
        setRefreshKey((v) => v + 1);
      }
    } catch (err) {
      setError((err as Error).message || "업로드 중 오류가 발생했어요.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleOpen(a: Attachment) {
    setViewing(a);
  }

  async function handleDelete(a: Attachment) {
    if (!confirm(`"${a.filename}" 을 삭제하시겠습니까?`)) return;
    const ok = await deleteAttachment(a);
    if (ok) setRefreshKey((v) => v + 1);
  }

  const list = items ?? [];

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="label">첨부 · {list.length}</h2>
        {canManage && (
          <button
            type="button"
            onClick={handlePick}
            disabled={busy}
            className="text-xs text-foreground-muted hover:text-foreground disabled:opacity-60"
          >
            {busy ? "업로드 중..." : "+ 파일 추가"}
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        onChange={handleChange}
        className="hidden"
      />
      {error && <p className="mb-3 text-xs text-danger">{error}</p>}
      {loading ? null : list.length === 0 ? (
        <p className="text-sm text-foreground-faint">
          아직 첨부된 파일이 없습니다.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((a) => (
            <li
              key={a.id}
              className="py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap"
            >
              <button
                type="button"
                onClick={() => handleOpen(a)}
                className="text-left min-w-0 flex-1 hover:opacity-80"
              >
                <p className="text-sm truncate">{a.filename}</p>
                <p className="text-xs text-foreground-faint">
                  {formatBytes(a.size_bytes ?? 0)}
                  {a.mime ? ` · ${a.mime}` : ""}
                </p>
              </button>
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleDelete(a)}
                  className="text-xs text-danger hover:underline underline-offset-4 ml-auto"
                >
                  삭제
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {viewing && (
        <AttachmentViewer
          attachment={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
