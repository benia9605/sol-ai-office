/**
 * 수동 임시저장 UI — 폼 상단의 "불러오기" 배너 + 하단의 "임시저장" 버튼.
 * useDraft 훅과 함께 사용한다.
 */

/** 폼 상단: 임시저장본이 있을 때 복원/삭제 배너. */
export function DraftRestoreBanner({
  onRestore,
  onDiscard,
}: {
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border border-line bg-surface-muted px-4 py-2.5 text-xs">
      <span className="text-foreground-muted">
        임시저장된 내용이 있어요.
      </span>
      <span className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onRestore}
          className="text-foreground hover:underline underline-offset-4"
        >
          불러오기
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="text-foreground-faint hover:text-danger"
        >
          삭제
        </button>
      </span>
    </div>
  );
}

/** 폼 하단(저장 버튼 옆): 수동 임시저장 버튼 + 저장됨 표시. */
export function DraftSaveButton({
  onSave,
  savedAt,
  disabled,
}: {
  onSave: () => void;
  savedAt: number | null;
  disabled?: boolean;
}) {
  return (
    <span className="flex items-center gap-2">
      {savedAt != null && (
        <span className="text-[11px] text-accent-teal">임시저장됨</span>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="border border-line-strong px-5 py-2.5 text-sm text-foreground hover:border-foreground disabled:opacity-60"
      >
        임시저장
      </button>
    </span>
  );
}
