import { useState, type FormEvent } from "react";
import { inputClass, labelClass } from "@/features/auth/_shared";
import type { MemberWithProfile } from "@/lib/data/workspace-members";

type Props = {
  members: MemberWithProfile[];
  /** Pre-select an assignee (e.g. current user for "내 할일" tab). */
  defaultAssigneeId?: string | null;
  onCreate: (input: {
    title: string;
    assignee_id: string | null;
    due_date: string | null;
  }) => Promise<void>;
  onClose: () => void;
};

/**
 * Inline 할일 quick-add form. Toggled open by a button in the parent
 * (TasksPage owns the open state so the trigger can live on the tab row).
 */
export function TaskQuickAddForm({
  members,
  defaultAssigneeId,
  onCreate,
  onClose,
}: Props) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | null>(
    defaultAssigneeId ?? null,
  );
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    await onCreate({
      title: title.trim(),
      assignee_id: assigneeId,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
    });
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="border border-line p-4 space-y-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="할 일 내용을 입력하세요."
        className={inputClass}
        autoFocus
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>담당자</label>
          <select
            value={assigneeId ?? ""}
            onChange={(e) => setAssigneeId(e.target.value || null)}
            className={`${inputClass} mt-1`}
          >
            <option value="">미지정</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.profile.name ?? m.profile.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>기한</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="border border-line-strong px-4 py-2 text-xs text-foreground hover:border-foreground"
        >
          닫기
        </button>
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="bg-accent-teal text-accent-foreground px-4 py-2 text-xs hover:bg-accent-teal/85 transition-colors disabled:opacity-60"
        >
          {busy ? "저장 중..." : "할일 추가"}
        </button>
      </div>
    </form>
  );
}
