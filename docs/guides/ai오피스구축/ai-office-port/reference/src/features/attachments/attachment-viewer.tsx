import { useEffect, useState } from "react";
import { getAttachmentUrl } from "@/lib/storage";
import type { Attachment } from "@/lib/types/database";

type Props = {
  attachment: Attachment;
  onClose: () => void;
};

/**
 * Modal viewer for attachments.
 *  - PDF / image → embedded directly
 *  - Office (doc/docx/ppt/pptx/xls/xlsx) → Office Online viewer iframe
 *    (requires the file URL to be publicly fetchable — signed URL works)
 *  - 그 외 → 새 탭에서 열기 안내
 */
export function AttachmentViewer({ attachment, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAttachmentUrl(attachment).then((u) => {
      if (cancelled) return;
      setUrl(u);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [attachment.id, attachment.storage_path]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const kind = detectKind(attachment.filename, attachment.mime);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center sm:justify-center sm:p-6">
      <div
        className="absolute inset-0 bg-foreground/60"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative bg-surface border border-line w-full sm:max-w-5xl sm:w-full max-h-full flex flex-col">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <p className="text-sm truncate flex-1">{attachment.filename}</p>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-foreground-muted hover:text-foreground border border-line-strong px-3 py-1.5 hover:border-foreground"
            >
              새 탭에서 열기
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-xs text-foreground-muted hover:text-foreground border border-line-strong px-3 py-1.5 hover:border-foreground"
          >
            닫기
          </button>
        </header>
        <div className="flex-1 bg-surface-muted overflow-auto">
          {loading ? (
            <p className="p-8 text-center text-sm text-foreground-faint">
              불러오는 중...
            </p>
          ) : !url ? (
            <p className="p-8 text-center text-sm text-foreground-faint">
              파일을 불러올 수 없어요.
            </p>
          ) : kind === "pdf" ? (
            <iframe
              src={url}
              title={attachment.filename}
              className="w-full h-[80vh] bg-white"
            />
          ) : kind === "image" ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <img
                src={url}
                alt={attachment.filename}
                className="max-w-full max-h-[80vh] object-contain"
              />
            </div>
          ) : kind === "office" ? (
            <iframe
              src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
              title={attachment.filename}
              className="w-full h-[80vh] bg-white"
            />
          ) : (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm text-foreground-muted">
                이 파일 형식은 직접 미리보기를 지원하지 않아요.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-block bg-accent-teal text-accent-foreground px-4 py-2 text-xs hover:bg-accent-teal/85"
              >
                다운로드 / 새 탭에서 열기
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type Kind = "pdf" | "image" | "office" | "other";

function detectKind(filename: string, mime: string | null): Kind {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const m = mime?.toLowerCase() ?? "";
  if (m === "application/pdf" || ext === "pdf") return "pdf";
  if (m.startsWith("image/")) return "image";
  if (
    ["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(ext) ||
    m.includes("officedocument") ||
    m.includes("msword") ||
    m.includes("ms-powerpoint") ||
    m.includes("ms-excel")
  ) {
    return "office";
  }
  return "other";
}
