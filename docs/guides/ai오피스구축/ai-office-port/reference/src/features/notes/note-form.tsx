import { useState, type FormEvent } from "react";
import { formatShortDate, formatTime } from "@/lib/format";
import { errorBox, inputClass, labelClass } from "@/features/auth/_shared";
import { RichEditor } from "@/features/editor/rich-editor";
import { useDraft } from "@/lib/use-draft";
import { DraftRestoreBanner, DraftSaveButton } from "@/features/common/draft-bar";
import type {
  Meeting,
  MeetingNote,
  Task,
} from "@/lib/types/database";
import type { NoteInput } from "@/lib/data/meeting-notes";
import type { MemberWithProfile } from "@/lib/data/workspace-members";

// 리스트 하단 배지형 버튼
const chipBtn =
  "border border-line-strong px-3 py-1.5 text-xs text-foreground-muted hover:border-foreground hover:text-foreground transition-colors";

export type ActionItemDraft = {
  /** Existing task id (when editing) or null for new rows. */
  id: string | null;
  title: string;
  assignee_id: string | null;
  /** YYYY-MM-DD or empty string. */
  due_date: string;
};

type Props = {
  /** Existing 회의록 row when editing; null when creating. */
  initial?: MeetingNote | null;
  /** Optional pre-selected 일정 (when creating a note from a schedule page). */
  preselectMeeting?: Meeting | null;
  /** All schedules in the workspace, used for the dropdown. */
  meetings: Meeting[];
  /** Workspace members shown in the 할일 담당자 dropdown. */
  members: MemberWithProfile[];
  /** Existing tasks linked to this note (edit mode). */
  initialTasks?: ReadonlyArray<Task>;
  /** 워크스페이스 전체 할일 — "기존 할일 불러오기" 다중 선택 picker 용. */
  workspaceTasks?: ReadonlyArray<Task>;
  /** 수동 임시저장 localStorage 키 (없으면 임시저장 UI 숨김). */
  draftKey?: string | null;
  onSubmit: (
    values: Omit<NoteInput, "workspace_id">,
    actionItems: ActionItemDraft[],
  ) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
  submitLabel: string;
};

export function NoteForm({
  initial,
  preselectMeeting,
  meetings,
  members,
  initialTasks,
  workspaceTasks,
  draftKey,
  onSubmit,
  onCancel,
  onDelete,
  submitLabel,
}: Props) {
  const [meetingId, setMeetingId] = useState<string | null>(
    initial?.meeting_id ?? preselectMeeting?.id ?? null,
  );
  const [agendaItems, setAgendaItems] = useState<string[]>(() => {
    const parsed = initial?.agenda
      ?.split("\n")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
    return parsed.length > 0 ? parsed : [""];
  });
  const [content, setContent] = useState(initial?.content ?? "");
  const [actions, setActions] = useState<ActionItemDraft[]>(() => {
    const seeded = (initialTasks ?? []).map<ActionItemDraft>((t) => ({
      id: t.id,
      title: t.title,
      assignee_id: t.assignee_id,
      due_date: t.due_date ? t.due_date.slice(0, 10) : "",
    }));
    return seeded.length > 0 ? seeded : [emptyAction()];
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // 수동 임시저장 — 자동 저장 안 함.
  const {
    draft,
    save: saveDraft,
    clear: clearDraft,
    savedAt,
  } = useDraft<{
    meetingId: string | null;
    agendaItems: string[];
    content: string;
    actions: ActionItemDraft[];
  }>(draftKey ?? null);
  const [restored, setRestored] = useState(false);

  function applyDraft() {
    if (!draft) return;
    setMeetingId(draft.meetingId);
    setAgendaItems(draft.agendaItems.length ? draft.agendaItems : [""]);
    setContent(draft.content);
    setActions(draft.actions.length ? draft.actions : [emptyAction()]);
    setRestored(true);
  }
  function saveDraftNow() {
    saveDraft({ meetingId, agendaItems, content, actions });
  }

  function updateAgenda(i: number, value: string) {
    setAgendaItems((items) => items.map((v, idx) => (idx === i ? value : v)));
  }
  function addAgenda() {
    setAgendaItems((items) => [...items, ""]);
  }
  function removeAgenda(i: number) {
    setAgendaItems((items) =>
      items.length === 1 ? [""] : items.filter((_, idx) => idx !== i),
    );
  }

  function updateAction(i: number, patch: Partial<ActionItemDraft>) {
    setActions((rows) =>
      rows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
    );
  }
  function addAction() {
    setActions((rows) => [...rows, emptyAction()]);
  }
  function removeAction(i: number) {
    setActions((rows) =>
      rows.length === 1 ? [emptyAction()] : rows.filter((_, idx) => idx !== i),
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const agendaText =
      agendaItems
        .map((s) => s.trim())
        .filter(Boolean)
        .join("\n") || null;

    const title = initial?.title ?? autoTitle(meetingId, meetings);

    // Drop empty action rows (no title)
    const filteredActions = actions
      .map((a) => ({ ...a, title: a.title.trim() }))
      .filter((a) => a.title.length > 0);

    try {
      await onSubmit(
        {
          meeting_id: meetingId,
          title,
          agenda: agendaText,
          content: content.trim() || null,
          summary: null,
        },
        filteredActions,
      );
      clearDraft();
    } catch (err) {
      setError((err as Error).message || "저장 중 오류가 발생했습니다.");
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!confirm("이 회의록을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    setBusy(true);
    try {
      await onDelete();
    } catch (err) {
      setError((err as Error).message || "삭제 중 오류가 발생했습니다.");
      setBusy(false);
    }
  }

  const previewTitle = initial?.title ?? autoTitle(meetingId, meetings);

  return (
    <form onSubmit={handleSubmit} className="space-y-12">
      {draftKey && draft && !restored && (
        <DraftRestoreBanner
          onRestore={applyDraft}
          onDiscard={() => {
            clearDraft();
            setRestored(true);
          }}
        />
      )}

      <header>
        <p className="label">Meeting Note</p>
        <h1 className="mt-3 text-3xl font-light leading-tight sm:text-4xl">
          {previewTitle}
        </h1>
      </header>

      <Section title="연결">
        <select
          value={meetingId ?? ""}
          onChange={(e) => setMeetingId(e.target.value || null)}
          className={inputClass}
          aria-label="연결된 일정"
        >
          <option value="">— 일정 미연결 (카톡 등) —</option>
          {meetings.map((m) => (
            <option key={m.id} value={m.id}>
              {formatShortDate(m.starts_at)} {formatTime(m.starts_at)} ·{" "}
              {m.title}
            </option>
          ))}
        </select>
      </Section>

      <Section title="아젠다">
        <ul className="space-y-2">
          {agendaItems.map((item, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-xs text-foreground-faint w-6 shrink-0 text-right tabular-nums">
                {i + 1}.
              </span>
              <input
                value={item}
                onChange={(e) => updateAgenda(i, e.target.value)}
                placeholder="안건"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => removeAgenda(i)}
                aria-label="아젠다 삭제"
                className="text-xl leading-none text-foreground-faint hover:text-danger px-2 -mr-2 disabled:opacity-30"
                disabled={agendaItems.length === 1 && !agendaItems[0]}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={addAgenda}
          className="mt-3 text-xs text-foreground-muted hover:text-foreground"
        >
          + 아젠다 추가
        </button>
      </Section>

      <Section title="회의 내용">
        <Stacked label="본문">
          <RichEditor
            value={content}
            onChange={setContent}
            placeholder="아젠다 별로 정리한 토론 내용을 적습니다."
            minHeight={240}
          />
        </Stacked>
      </Section>

      <Section
        title="할일"
        subtitle="회의 결과로 정해진 액션 아이템. 저장 시 회의록에 연결된 할일로 등록됩니다."
      >
        <BulkAssignForm
          members={members}
          onAdd={(rows) => setActions((prev) => prev.concat(rows))}
        />
        <ul className="mt-6 space-y-4 sm:space-y-3">
          {actions.map((row, i) => (
            <li
              key={row.id ?? `new-${i}`}
              className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-[1fr_160px_140px_auto] sm:gap-2 sm:items-center"
            >
              <input
                value={row.title}
                onChange={(e) => updateAction(i, { title: e.target.value })}
                placeholder="내용"
                className={inputClass}
              />
              {/* On mobile, group the three controls into a single line below
                  the title. On sm+, the wrapper disappears via sm:contents so
                  each control becomes a direct grid child. */}
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 sm:contents">
                <select
                  value={row.assignee_id ?? ""}
                  onChange={(e) =>
                    updateAction(i, { assignee_id: e.target.value || null })
                  }
                  className={inputClass}
                  aria-label="담당자"
                >
                  <option value="">담당자 미지정</option>
                  {members.map((m) => {
                    const display = m.profile.name ?? m.profile.email;
                    return (
                      <option key={m.user_id} value={m.user_id}>
                        {display}
                      </option>
                    );
                  })}
                </select>
                <input
                  type="date"
                  value={row.due_date}
                  onChange={(e) =>
                    updateAction(i, { due_date: e.target.value })
                  }
                  className={`${inputClass} w-32 sm:w-auto`}
                  aria-label="기한"
                />
                <button
                  type="button"
                  onClick={() => removeAction(i)}
                  aria-label="할일 삭제"
                  className="text-xl leading-none text-foreground-faint hover:text-danger px-2 sm:px-0 sm:w-8 sm:text-right disabled:opacity-30"
                  disabled={
                    actions.length === 1 &&
                    !row.title &&
                    !row.assignee_id &&
                    !row.due_date
                  }
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>

        {/* 리스트 하단 — 배지형 버튼 두 개를 같은 줄에 */}
        {(() => {
          const candidates = (workspaceTasks ?? []).filter(
            (t) => !actions.some((a) => a.id === t.id),
          );
          return (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={addAction} className={chipBtn}>
                  + 할일 추가
                </button>
                {candidates.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPickerOpen((v) => !v)}
                    className={`${chipBtn} ${
                      pickerOpen ? "border-foreground text-foreground" : ""
                    }`}
                  >
                    + 기존 할일 불러오기
                  </button>
                )}
              </div>
              {pickerOpen && candidates.length > 0 && (
                <ExistingTaskPanel
                  candidates={candidates}
                  members={members}
                  onAdd={(rows) =>
                    setActions((prev) => {
                      // 빈 첫 행만 있으면 그 자리를 채우고, 아니면 뒤에 붙인다.
                      const base =
                        prev.length === 1 && !prev[0].title && !prev[0].id
                          ? []
                          : prev;
                      return base.concat(rows);
                    })
                  }
                  onClose={() => setPickerOpen(false)}
                />
              )}
            </>
          );
        })()}
      </Section>

      {error && <p className={errorBox}>{error}</p>}

      {/* 취소 · 삭제 · 수정저장 순 (임시저장은 좌측) */}
      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-6">
        {draftKey && (
          <span className="mr-auto">
            <DraftSaveButton
              onSave={saveDraftNow}
              savedAt={savedAt}
              disabled={busy}
            />
          </span>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="border border-line-strong px-5 py-2.5 text-sm text-foreground hover:border-foreground disabled:opacity-60"
        >
          취소
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="border border-line-strong px-5 py-2.5 text-sm text-danger hover:border-danger disabled:opacity-60"
          >
            삭제
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className="border border-accent bg-accent px-5 py-2.5 text-sm text-accent-foreground hover:bg-foreground-muted hover:border-foreground-muted disabled:opacity-60"
        >
          {busy ? "저장 중..." : submitLabel}
        </button>
      </footer>
    </form>
  );
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function emptyAction(): ActionItemDraft {
  return { id: null, title: "", assignee_id: null, due_date: "" };
}

/**
 * Compute the 회의록 title when the user hasn't entered one.
 * - Linked to a 일정 → use that 일정 title verbatim
 * - Standalone → "YYYY-MM-DD 회의록"
 */
function autoTitle(meetingId: string | null, meetings: Meeting[]): string {
  if (meetingId) {
    const m = meetings.find((x) => x.id === meetingId);
    if (m) return m.title;
  }
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 회의록`;
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 border-b border-line pb-3">
        <h2 className="text-base">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-xs text-foreground-faint">{subtitle}</p>
        )}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Stacked({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-1 text-xs text-foreground-faint">{hint}</p>}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// 기존 할일 불러오기 — 워크스페이스의 기존 할일을 다중 선택해 이 회의록에 연결
// ───────────────────────────────────────────────────────────────

function ExistingTaskPanel({
  candidates,
  members,
  onAdd,
  onClose,
}: {
  candidates: ReadonlyArray<Task>;
  members: MemberWithProfile[];
  onAdd: (rows: ActionItemDraft[]) => void;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function assigneeName(id: string | null): string {
    if (!id) return "미지정";
    const m = members.find((x) => x.user_id === id);
    return m?.profile.name ?? m?.profile.email ?? "미지정";
  }

  function handleAdd() {
    const rows: ActionItemDraft[] = candidates
      .filter((t) => checked.has(t.id))
      .map((t) => ({
        id: t.id,
        title: t.title,
        assignee_id: t.assignee_id,
        due_date: t.due_date ? t.due_date.slice(0, 10) : "",
      }));
    if (rows.length === 0) return;
    onAdd(rows);
    setChecked(new Set());
    onClose();
  }

  return (
    <div className="mt-2">
      <div className="border border-line">
        <ul className="max-h-64 overflow-y-auto divide-y divide-line">
            {candidates.map((t) => {
              const on = checked.has(t.id);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => toggle(t.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      on ? "bg-accent-teal/10" : "hover:bg-surface-muted"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`shrink-0 w-4 h-4 border flex items-center justify-center text-[10px] ${
                        on
                          ? "bg-accent-teal border-accent-teal text-accent-foreground"
                          : "border-line-strong text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-sm truncate ${
                          t.status === "done"
                            ? "line-through text-foreground-faint"
                            : ""
                        }`}
                      >
                        {t.title}
                      </span>
                      <span className="block text-xs text-foreground-faint truncate">
                        {assigneeName(t.assignee_id)}
                        {t.note_id ? " · 다른 회의록에 연결됨" : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-end gap-2 border-t border-line px-3 py-2">
            <span className="mr-auto text-xs text-foreground-faint">
              {checked.size}개 선택
            </span>
            <button
              type="button"
              onClick={handleAdd}
              disabled={checked.size === 0}
              className="bg-accent-teal text-accent-foreground px-4 py-2 text-xs hover:bg-accent-teal/85 disabled:opacity-60"
            >
              연결
            </button>
          </div>
        </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// 전체 과제 — 한 가지 내용을 모든 멤버에게 일괄 배정
// ───────────────────────────────────────────────────────────────

function BulkAssignForm({
  members,
  onAdd,
}: {
  members: MemberWithProfile[];
  onAdd: (rows: ActionItemDraft[]) => void;
}) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  function handleAdd() {
    const t = title.trim();
    if (!t || members.length === 0) return;
    const rows: ActionItemDraft[] = members.map((m) => ({
      id: null,
      title: t,
      assignee_id: m.user_id,
      due_date: due,
    }));
    onAdd(rows);
    setTitle("");
    setDue("");
  }

  return (
    <div className="border border-line p-4 space-y-3 bg-surface-muted">
      <p className="label">전체 과제 · 모든 멤버에게 일괄 배정</p>
      <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-[1fr_140px_auto] sm:gap-2 sm:items-center">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 다음 모임 전까지 책 1챕터 읽기"
          className={inputClass}
        />
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className={`${inputClass} w-32 sm:w-auto`}
          aria-label="기한"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!title.trim() || members.length === 0}
          className="bg-accent-teal text-accent-foreground px-4 py-2 text-xs hover:bg-accent-teal/85 disabled:opacity-60"
        >
          멤버 {members.length}명에게 추가
        </button>
      </div>
    </div>
  );
}
