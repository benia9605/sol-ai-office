import { useState, useMemo, type FormEvent } from "react";
import type { Meeting, MeetingType } from "@/lib/types/database";
import type { MeetingInput } from "@/lib/data/meetings";
import type { MemberWithProfile } from "@/lib/data/workspace-members";
import type { ProjectWithMeta } from "@/lib/data/projects";
import { Avatar } from "@/components/avatar";
import { errorBox, inputClass, labelClass } from "@/features/auth/_shared";
import { TypePicker } from "./type-picker";
import { LocationPicker } from "./location-picker";

type Props = {
  /** Pre-fill values when editing; null/undefined when creating. */
  initial?: Meeting | null;
  /** User ids who should start as attendees (only relevant on edit). */
  initialAttendeeIds?: ReadonlyArray<string>;
  /** Workspace members shown as attendee checkboxes. */
  members: MemberWithProfile[];
  /** Meeting types available in this workspace (admin-managed). */
  types: MeetingType[];
  /** Projects in this workspace, for optional 연동. */
  projects: ProjectWithMeta[];
  /** Submit handler. Resolves on success; throw to surface an error. */
  onSubmit: (
    values: Omit<MeetingInput, "workspace_id">,
    attendeeIds: string[],
  ) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  /** Optional delete action — shown as a quiet danger link when present. */
  onDelete?: () => Promise<void>;
};

export function MeetingForm({
  initial,
  initialAttendeeIds,
  members,
  types,
  projects,
  onSubmit,
  onCancel,
  submitLabel,
  onDelete,
}: Props) {
  const defaultStart = useMemo(() => nextHourLocal(), []);
  const defaultTypeId =
    initial?.type_id ??
    (types.find((t) => t.sort_order === 0) ?? types[0])?.id ??
    null;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [typeId, setTypeId] = useState<string | null>(defaultTypeId);
  const [projectId, setProjectId] = useState<string | null>(
    initial?.project_id ?? null,
  );
  const [startsAt, setStartsAt] = useState(
    initial ? toLocalInput(initial.starts_at) : defaultStart,
  );
  const [endsAt, setEndsAt] = useState(
    initial?.ends_at ? toLocalInput(initial.ends_at) : "",
  );

  const [attendees, setAttendees] = useState<Set<string>>(() => {
    const seed = initialAttendeeIds ?? members.map((m) => m.user_id);
    return new Set(seed);
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAttendee(userId: string) {
    setAttendees((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }
  function selectAllAttendees() {
    setAttendees(new Set(members.map((m) => m.user_id)));
  }
  function clearAttendees() {
    setAttendees(new Set());
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("제목은 필수입니다.");
      return;
    }
    if (!startsAt) {
      setError("시작 일시는 필수입니다.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(
        {
          type_id: typeId,
          project_id: projectId,
          title: title.trim(),
          description: description.trim() || null,
          location: location.trim() || null,
          starts_at: fromLocalInput(startsAt),
          ends_at: endsAt ? fromLocalInput(endsAt) : null,
        },
        Array.from(attendees),
      );
    } catch (err) {
      setError((err as Error).message || "저장 중 오류가 발생했습니다.");
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!confirm("이 일정을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    setBusy(true);
    try {
      await onDelete();
    } catch (err) {
      setError((err as Error).message || "삭제 중 오류가 발생했습니다.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-12">
      <Section title="기본 정보">
        <div className="grid gap-5 sm:grid-cols-2">
          <Stacked label="종류">
            <TypePicker
              types={types}
              value={typeId}
              onChange={setTypeId}
              placeholder="종류 선택"
            />
          </Stacked>
          <Stacked label="연결 프로젝트">
            <select
              value={projectId ?? ""}
              onChange={(e) => setProjectId(e.target.value || null)}
              className={inputClass}
            >
              <option value="">없음</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.emoji} {p.name}
                </option>
              ))}
            </select>
          </Stacked>
        </div>
        <Stacked label="제목 *">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 5월 셋째주 모임"
            className={inputClass}
          />
        </Stacked>
        <Stacked label="설명">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={`${inputClass} resize-none`}
            placeholder="일정 한 줄 소개."
          />
        </Stacked>
        <Stacked label="장소">
          <LocationPicker value={location} onChange={setLocation} />
        </Stacked>
      </Section>

      <Section title="일시">
        <div className="grid gap-5 sm:grid-cols-2">
          <Stacked label="시작 *">
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={inputClass}
            />
          </Stacked>
          <Stacked label="종료">
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={inputClass}
            />
          </Stacked>
        </div>
      </Section>

      <Section
        title={`참석자 · ${attendees.size} / ${members.length}`}
        action={
          <div className="flex gap-3 text-xs">
            <button
              type="button"
              onClick={selectAllAttendees}
              className="text-foreground-muted hover:text-foreground"
            >
              전체 선택
            </button>
            <button
              type="button"
              onClick={clearAttendees}
              className="text-foreground-muted hover:text-foreground"
            >
              전체 해제
            </button>
          </div>
        }
      >
        <ul className="grid gap-px bg-surface-muted border border-line sm:grid-cols-2">
          {members.map((m) => {
            const display = m.profile.name ?? m.profile.email;
            const subtitle = [m.profile.company, m.profile.position]
              .filter(Boolean)
              .join(" · ");
            const checked = attendees.has(m.user_id);
            return (
              <li key={m.user_id} className="bg-surface">
                <button
                  type="button"
                  onClick={() => toggleAttendee(m.user_id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-muted"
                >
                  <span
                    aria-hidden
                    className={`flex items-center justify-center size-4 border shrink-0 ${
                      checked
                        ? "border-foreground bg-foreground text-accent-foreground"
                        : "border-line-strong"
                    }`}
                  >
                    {checked ? "✓" : ""}
                  </span>
                  <Avatar
                    url={m.profile.avatar_url}
                    name={display}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{display}</p>
                    {subtitle && (
                      <p className="text-xs text-foreground-muted truncate">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      {error && <p className={errorBox}>{error}</p>}

      <footer className="flex flex-wrap items-center gap-2 border-t border-line pt-6">
        {onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="text-xs text-danger hover:underline underline-offset-4 mr-auto disabled:opacity-60"
          >
            일정 삭제
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="border border-line-strong px-5 py-2.5 text-sm text-foreground hover:border-foreground disabled:opacity-60"
        >
          취소
        </button>
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
// Local helpers
// ───────────────────────────────────────────────────────────────

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex items-baseline justify-between border-b border-line pb-3">
        <h2 className="text-base">{title}</h2>
        {action}
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

/** ISO → "YYYY-MM-DDTHH:MM" in the user's local timezone. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** datetime-local value → ISO string. */
function fromLocalInput(local: string): string {
  return new Date(local).toISOString();
}

/** Default "next hour at :00" for the create form's starts_at. */
function nextHourLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toLocalInput(d.toISOString());
}
