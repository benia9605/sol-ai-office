import { useState } from "react";

type Props = {
  isAuthor: boolean;
  isAdmin: boolean;
  isShared: boolean;
  editing?: boolean;
  onEdit?: () => void;
  /** is_shared 토글 (true ↔ false). */
  onToggleShared: (next: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
  /**
   * "이 글", "이 자료", "이 인사이트" 등 컨텍스트 단어.
   * 삭제/숨김 확인 메시지에 들어감.
   */
  noun?: string;
};

/**
 * 글/인사이트/독서 상세 페이지 공통 모더레이션 컨트롤.
 *
 * 작성자: 편집 · 숨김↔공개 · 삭제
 * 관리자(작성자 아닌 경우): 숨김↔공개 · 삭제 (편집은 침범 방지 차 X)
 * 그 외: 아무것도 안 보임
 */
export function PostModerationBar({
  isAuthor,
  isAdmin,
  isShared,
  editing,
  onEdit,
  onToggleShared,
  onDelete,
  noun = "이 글",
}: Props) {
  const [busy, setBusy] = useState<"share" | "delete" | null>(null);

  if (!isAuthor && !isAdmin) return null;
  if (editing) return null;

  async function handleToggleShared() {
    if (busy) return;
    const next = !isShared;
    const confirmMsg = next
      ? `${noun}을(를) 다시 공개하시겠습니까?`
      : `${noun}을(를) 숨김 처리하면 본인만 볼 수 있습니다. 진행할까요?`;
    if (!confirm(confirmMsg)) return;
    setBusy("share");
    try {
      await onToggleShared(next);
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (busy) return;
    if (!confirm(`${noun}을(를) 삭제하시겠습니까? 되돌릴 수 없습니다.`)) return;
    setBusy("delete");
    try {
      await onDelete();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {isAuthor && onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="border border-line-strong px-3 py-1.5 hover:border-foreground transition-colors"
        >
          편집
        </button>
      )}
      <button
        type="button"
        onClick={handleToggleShared}
        disabled={busy !== null}
        className="border border-line-strong px-3 py-1.5 hover:border-foreground transition-colors disabled:opacity-60"
      >
        {busy === "share" ? "처리 중…" : isShared ? "숨김" : "공개"}
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy !== null}
        className="px-2 text-danger hover:underline underline-offset-4 disabled:opacity-60"
      >
        {busy === "delete" ? "삭제 중…" : isAuthor ? "삭제" : "삭제 (운영자)"}
      </button>
    </div>
  );
}
