/* ============================================================================
 * 화면 ⑥ — 회의록 작성 / 편집 페이지
 *            (라우트: /notes/new  ·  /notes/:id/edit — 둘 다 같은 폼)
 * ============================================================================
 *
 * ★ 할일(03)과 결정적으로 다른 점: **모드 토글이 아니라 별도 페이지**다.
 *   폼이 크고(아젠다 + 에디터 + 할일 3방식 + 임시저장) 스크롤이 길어서,
 *   같은 화면에서 갈아끼우면 스크롤 위치가 튄다. 그래도 **모달은 아니다** —
 *   URL 을 가진 페이지라서 새로고침·뒤로가기·링크 공유가 전부 정상 동작한다.
 *
 * 작성(/notes/new)과 편집(/notes/:id/edit)이 **같은 NoteForm 하나**를 쓴다.
 * 다른 건 `initial` 과 `submitLabel`, 그리고 저장 콜백뿐이다.
 *
 * 밋업 원본을 한 파일로 합친 디자인 참고본.
 *   src/pages/note-edit.tsx             ← 페이지 셸 + 저장 배선 (아래 NoteEditPage)
 *   src/pages/note-new.tsx              ← 작성 페이지 (거의 동일 — 주석 참고)
 *   src/features/notes/note-form.tsx    ← 폼 본체 + 하위 컴포넌트 전부
 *   src/lib/use-draft.ts                ← 임시저장 훅
 *   src/features/common/draft-bar.tsx   ← 임시저장 배너/버튼
 *   src/features/auth/_shared.tsx       ← inputClass / labelClass / errorBox
 *
 * ─── 화면 스케치 ────────────────────────────────────────────────────────────
 *
 *   ← 회의록
 *
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │ 임시저장된 내용이 있어요.               불러오기   삭제        │ ← 있을 때만
 *   └───────────────────────────────────────────────────────────────┘
 *
 *   MEETING NOTE
 *   3분기 전략 회의                     ← 제목은 입력칸이 없다. 자동 생성 프리뷰
 *
 *   연결 ─────────────────────────────────────────────────  ← Section 제목+border-b
 *   8월 20일 20:00 · 3분기 전략 회의 ▾______________________
 *
 *   아젠다 ───────────────────────────────────────────────
 *    1. [예산 재배분_______________________________]  ×
 *    2. [채용 계획_________________________________]  ×
 *   + 아젠다 추가
 *
 *   회의 내용 ────────────────────────────────────────────
 *   본문
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │ B I S │ H1 H2 H3 │ A H │ · 1. ☑ │ " <|> │ 🔗 🖼 ▶ HTML │ …   │ ← sticky
 *   ├───────────────────────────────────────────────────────────────┤
 *   │ (아젠다 별로 정리한 토론 내용)                                  │
 *   └───────────────────────────────────────────────────────────────┘
 *
 *   할일 ─────────────────────────────────────────────────
 *   회의 결과로 정해진 액션 아이템. 저장 시 회의록에 연결된 할일로 등록됩니다.
 *   ┌─ bg-surface-muted ────────────────────────────────────────────┐
 *   │ 전체 과제 · 모든 멤버에게 일괄 배정                             │
 *   │ [예: 다음 모임 전까지 책 1챕터 읽기___] [기한]  [멤버 6명에게 추가]│
 *   └───────────────────────────────────────────────────────────────┘
 *   [예산안 초안 작성______] [김대표 ▾] [8/24] ×
 *   [경쟁사 리서치________] [박이사 ▾] [8/20] ×
 *   [+ 할일 추가] [+ 기존 할일 불러오기]
 *   ┌─ (기존 할일 불러오기를 누르면 펼쳐지는 다중선택 패널) ──────────┐
 *   │ ✓ 채용 공고 초안        김대표                                  │
 *   │ ☐ 콘텐츠 캘린더        이대표 · 다른 회의록에 연결됨            │
 *   │ 2개 선택                                          [연결]       │
 *   └───────────────────────────────────────────────────────────────┘
 *
 *   ────────────────────────────────────────────────────── border-t
 *   [임시저장]                              [취소] [삭제] [수정 저장]
 *
 * ─── 이 화면의 핵심 설계 ────────────────────────────────────────────────────
 *
 *  1) **제목 입력칸이 없다.** 연결된 일정이 있으면 그 제목, 없으면
 *     "YYYY-MM-DD 회의록". 매번 제목을 고민하게 만드는 마찰을 없앴다.
 *
 *  2) **아젠다는 별도 테이블이 아니다.** 순서 있는 문자열 목록일 뿐이라
 *     '\n' 으로 join 해서 text 컬럼 하나에 저장한다.
 *
 *  3) **저장 버튼 한 번에 회의록 + 할일이 같이 저장된다.**
 *     폼은 DB 를 모른다. `onSubmit(values, actionItems)` 로 두 덩이를 넘기고,
 *     페이지가 updateNote → syncTasksForNote 순으로 처리한다.
 *
 *  4) **할일 배정 방식이 3가지다.** 개별 추가 / 전체 일괄 배정 / 기존 불러오기.
 *     일괄 배정은 할일 row 를 멤버 수만큼 만든다 (1개가 아니다) —
 *     각자 자기 진행률과 자기 댓글을 가져야 하니까.
 *
 *  5) **알림 코드가 한 줄도 없다.** 저장하면
 *       new_note → 전체 멤버 / new_task → 배정된 담당자 각각
 *     이 자동으로 나간다. 전부 lib/data 안에서 처리된다.
 * ========================================================================== */

import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useAsync } from "@/lib/use-async";
import { useAuth } from "@/lib/auth-context";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { getMyRole } from "@/lib/data/workspaces";
import { getWorkspaceMeetings } from "@/lib/data/meetings";
import { getWorkspaceMembers } from "@/lib/data/workspace-members";
import { deleteNote, getNote, updateNote } from "@/lib/data/meeting-notes";
import { getTasks, getTasksForNote, syncTasksForNote } from "@/lib/data/tasks";
import { RichEditor } from "@/features/editor/rich-editor";
import { formatShortDate, formatTime } from "@/lib/format";
import type { Meeting, MeetingNote, Task } from "@/lib/types/database";
import type { NoteInput } from "@/lib/data/meeting-notes";
import type { MemberWithProfile } from "@/lib/data/workspace-members";

// ═══════════════════════════════════════════════════════════════════════════
// 공통 폼 스타일  (원본: src/features/auth/_shared.tsx)
// ═══════════════════════════════════════════════════════════════════════════

/** 밑줄만 있는 인풋. 박스 없음 · 포커스 시 밑줄만 진해짐. */
export const inputClass =
  "w-full border-b border-line-strong px-0 py-2 text-sm focus:border-foreground focus:outline-none bg-transparent placeholder:text-foreground-faint";

export const labelClass = "text-xs text-foreground-muted";

export const errorBox =
  "border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger";

/** 리스트 하단 배지형 버튼 (+ 할일 추가 / + 기존 할일 불러오기). */
const chipBtn =
  "border border-line-strong px-3 py-1.5 text-xs text-foreground-muted hover:border-foreground hover:text-foreground transition-colors";

// ═══════════════════════════════════════════════════════════════════════════
// 페이지 셸 — 데이터 로딩 + 저장 배선
// ═══════════════════════════════════════════════════════════════════════════

export function NoteEditPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { workspace } = useActiveWorkspace();
  const navigate = useNavigate();

  const { data: note, loading } = useAsync(
    () => (id ? getNote(id) : Promise.resolve(null)),
    [id],
  );
  const { data: meetings } = useAsync(
    () => (workspace ? getWorkspaceMeetings(workspace.id) : Promise.resolve([])),
    [workspace?.id],
  );
  const { data: members } = useAsync(
    () => (workspace ? getWorkspaceMembers(workspace.id) : Promise.resolve([])),
    [workspace?.id],
  );
  /** 이 회의록에 이미 연결된 할일 — 폼의 초기 행이 된다. */
  const { data: existingTasks } = useAsync(
    () => (id ? getTasksForNote(id) : Promise.resolve([])),
    [id],
  );
  /** 워크스페이스 전체 할일 — "기존 할일 불러오기" 후보. */
  const { data: workspaceTasks } = useAsync(
    () => (workspace ? getTasks({ workspaceId: workspace.id }) : Promise.resolve([])),
    [workspace?.id],
  );
  const { data: myRole } = useAsync(
    () =>
      workspace && user
        ? getMyRole(workspace.id, user.id)
        : Promise.resolve(null),
    [workspace?.id, user?.id],
  );

  if (loading) return null;
  if (!note) return <Navigate to="/notes" replace />;
  if (!user) return null;

  const canManage =
    note.created_by === user.id || myRole === "owner" || myRole === "admin";
  // 권한 없으면 편집 URL 에 직접 들어와도 뷰어로 되돌린다
  if (!canManage) return <Navigate to={`/notes/${note.id}`} replace />;

  return (
    <div className="space-y-10 max-w-3xl">
      <div>
        <Link
          to={`/notes/${note.id}`}
          className="text-xs text-foreground-muted hover:text-foreground"
        >
          ← 회의록
        </Link>
      </div>

      {meetings === null || members === null || existingTasks === null ? (
        <p className="border-y border-line py-10 text-center text-sm text-foreground-faint">
          로딩 중...
        </p>
      ) : (
        <NoteForm
          initial={note}
          meetings={meetings}
          members={members}
          initialTasks={existingTasks}
          workspaceTasks={workspaceTasks ?? []}
          // 임시저장 키는 문서 + 사용자별로 분리 (공용 키면 남의 초안이 튀어나온다)
          draftKey={`note-draft:${note.id}:${user.id}`}
          submitLabel="수정 저장"
          onSubmit={async (values, actions) => {
            // ① 회의록 저장
            const updated = await updateNote(note.id, values);
            if (!updated) throw new Error("회의록 수정에 실패했습니다.");

            // ② 할일 동기화 — 삭제 → 수정(note_id 강제) → 생성 순.
            //    전부 지우고 다시 만들면 완료 상태 · 댓글 · 첨부가 다 날아간다.
            //    id 가 있으면 keep(기존 행), 없으면 create(새 행).
            await syncTasksForNote(
              note.id,
              workspace!.id,
              updated.meeting_id,
              user.id,
              {
                keep: actions
                  .filter((a) => a.id)
                  .map((a) => ({
                    id: a.id!,
                    patch: {
                      title: a.title,
                      assignee_id: a.assignee_id,
                      // 날짜만 있는 필드 → 자정 기준 ISO
                      due_date: a.due_date
                        ? new Date(a.due_date).toISOString()
                        : null,
                      meeting_id: updated.meeting_id,
                    },
                  })),
                create: actions
                  .filter((a) => !a.id)
                  .map((a) => ({
                    title: a.title,
                    assignee_id: a.assignee_id,
                    due_date: a.due_date
                      ? new Date(a.due_date).toISOString()
                      : null,
                  })),
              },
            );

            // ③ 저장 끝나면 뷰어로 (새 URL 이 아니라 원래 상세 페이지)
            navigate(`/notes/${note.id}`);
          }}
          onCancel={() => navigate(`/notes/${note.id}`)}
          onDelete={async () => {
            const ok = await deleteNote(note.id);
            if (!ok) throw new Error("삭제에 실패했습니다.");
            navigate("/notes");
          }}
        />
      )}
    </div>
  );
}

/* ── 작성 페이지(/notes/new)는 거의 같다 ──────────────────────────────────
 *   차이는 이것뿐:
 *     · initial 을 안 넘긴다 (빈 폼)
 *     · preselectMeeting — /notes/new?meeting=xxx 로 들어오면 일정이 미리 선택됨
 *       (일정 상세의 "회의록 작성" 버튼이 이 링크를 쓴다)
 *     · draftKey = `note-draft:new:${workspace.id}:${user.id}`
 *     · submitLabel = "회의록 작성"
 *     · onSubmit 에서 updateNote 대신 createNote → 같은 syncTasksForNote 호출
 *       (새 노트라 keep 은 "기존 할일 불러오기"로 끌어온 것만 들어있다)
 *     · onDelete 를 안 넘긴다 (아직 없는 문서라 삭제할 게 없음)
 *   전체 코드: reference/src/pages/note-new.tsx
 * ──────────────────────────────────────────────────────────────────────── */

// ═══════════════════════════════════════════════════════════════════════════
// 폼 본체  (원본: src/features/notes/note-form.tsx)
// ═══════════════════════════════════════════════════════════════════════════

export type ActionItemDraft = {
  /** 기존 할일이면 id, 새 행이면 null. 이 값이 keep/create 를 가른다. */
  id: string | null;
  title: string;
  assignee_id: string | null;
  /** 'YYYY-MM-DD' 또는 빈 문자열. */
  due_date: string;
};

function NoteForm({
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
}: {
  /** 편집이면 기존 회의록, 작성이면 없음. */
  initial?: MeetingNote | null;
  /** 일정 상세에서 넘어왔을 때 미리 선택할 일정. */
  preselectMeeting?: Meeting | null;
  meetings: Meeting[];
  members: MemberWithProfile[];
  initialTasks?: ReadonlyArray<Task>;
  workspaceTasks?: ReadonlyArray<Task>;
  draftKey?: string | null;
  onSubmit: (
    values: Omit<NoteInput, "workspace_id">,
    actionItems: ActionItemDraft[],
  ) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
  submitLabel: string;
}) {
  const [meetingId, setMeetingId] = useState<string | null>(
    initial?.meeting_id ?? preselectMeeting?.id ?? null,
  );
  // 아젠다는 '\n' 문자열 ↔ 배열 변환. 최소 한 줄은 늘 유지한다.
  const [agendaItems, setAgendaItems] = useState<string[]>(() => {
    const parsed =
      initial?.agenda?.split("\n").map((s) => s.trim()).filter(Boolean) ?? [];
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

  // 수동 임시저장 — 자동 저장 안 함
  const { draft, save: saveDraft, clear: clearDraft, savedAt } = useDraft<{
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

  // ── 아젠다 행 조작 ──────────────────────────────────────────────────
  function updateAgenda(i: number, value: string) {
    setAgendaItems((items) => items.map((v, idx) => (idx === i ? value : v)));
  }
  function addAgenda() {
    setAgendaItems((items) => [...items, ""]);
  }
  function removeAgenda(i: number) {
    // 마지막 한 줄은 지우지 않고 비운다 (빈 리스트가 되지 않게)
    setAgendaItems((items) =>
      items.length === 1 ? [""] : items.filter((_, idx) => idx !== i),
    );
  }

  // ── 할일 행 조작 ────────────────────────────────────────────────────
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

    // 아젠다 → '\n' 문자열. 전부 비었으면 null
    const agendaText =
      agendaItems.map((s) => s.trim()).filter(Boolean).join("\n") || null;

    // 제목은 입력칸이 없다 — 자동 생성
    const title = initial?.title ?? autoTitle(meetingId, meetings);

    // 제목이 빈 할일 행은 버린다 (사용자가 추가만 하고 안 채운 행)
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
      clearDraft(); // 실제 저장 성공 → 임시저장본 폐기
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
      {/* ── 임시저장 복원 배너 ─────────────────────────────────────────── */}
      {draftKey && draft && !restored && (
        <DraftRestoreBanner
          onRestore={applyDraft}
          onDiscard={() => {
            clearDraft();
            setRestored(true);
          }}
        />
      )}

      {/* ── 제목 — 입력칸이 아니라 자동 생성 프리뷰 ────────────────────
          일정을 바꾸면 제목도 실시간으로 바뀐다. */}
      <header>
        <p className="label">Meeting Note</p>
        <h1 className="mt-3 text-3xl font-light leading-tight sm:text-4xl">
          {previewTitle}
        </h1>
      </header>

      {/* ── 연결 ─────────────────────────────────────────────────────── */}
      <Section title="연결">
        <select
          value={meetingId ?? ""}
          onChange={(e) => setMeetingId(e.target.value || null)}
          className={inputClass}
          aria-label="연결된 일정"
        >
          {/* "미연결"을 명시적 선택지로 둔다 — 카톡 회의도 1급 시민 */}
          <option value="">— 일정 미연결 (카톡 등) —</option>
          {meetings.map((m) => (
            <option key={m.id} value={m.id}>
              {formatShortDate(m.starts_at)} {formatTime(m.starts_at)} · {m.title}
            </option>
          ))}
        </select>
      </Section>

      {/* ── 아젠다 ───────────────────────────────────────────────────── */}
      <Section title="아젠다">
        <ul className="space-y-2">
          {agendaItems.map((item, i) => (
            <li key={i} className="flex items-center gap-2">
              {/* 번호는 고정폭 우측정렬 — 10. 이 되어도 입력칸이 안 밀린다 */}
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

      {/* ── 회의 내용 (에디터) ────────────────────────────────────────
          툴바 sticky. 붙여넣기: 유튜브 URL → 임베드 / 마크다운 → HTML 변환.
          전체 구현: reference/src/features/editor/rich-editor.tsx */}
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

      {/* ── 할일 (액션 아이템) ────────────────────────────────────────── */}
      <Section
        title="할일"
        subtitle="회의 결과로 정해진 액션 아이템. 저장 시 회의록에 연결된 할일로 등록됩니다."
      >
        {/* 방식 ② 전체 일괄 배정 — 같은 일을 전원에게 */}
        <BulkAssignForm
          members={members}
          onAdd={(rows) => setActions((prev) => prev.concat(rows))}
        />

        {/* 방식 ① 개별 행 */}
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
              {/* ★ 모바일에선 이 wrapper 가 컨트롤 3개를 한 줄로 묶고,
                  sm 이상에선 `sm:contents` 로 wrapper 가 사라져
                  각 컨트롤이 그리드의 직접 자식이 된다. 마크업 중복 없이
                  모바일 2줄 ↔ 데스크탑 1줄 4열을 만드는 기법. */}
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
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.profile.name ?? m.profile.email}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={row.due_date}
                  onChange={(e) => updateAction(i, { due_date: e.target.value })}
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
          // 이미 이 회의록에 올라온 할일은 후보에서 제외
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
              {/* 방식 ③ 기존 할일 불러오기 */}
              {pickerOpen && candidates.length > 0 && (
                <ExistingTaskPanel
                  candidates={candidates}
                  members={members}
                  onAdd={(rows) =>
                    setActions((prev) => {
                      // 빈 첫 행만 있으면 그 자리를 채우고, 아니면 뒤에 붙인다
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

      {/* ── 하단 버튼 — 임시저장(좌측 끝) · 취소 · 삭제 · 저장 ────────── */}
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
        {/* 저장은 검정 채움 (accent = 브랜드 먹색). 할일 폼과 달리
            "완료" 개념이 없어서 액센트-틸이 아닌 기본 accent 를 쓴다. */}
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

// ═══════════════════════════════════════════════════════════════════════════
// 할일 배정 방식 ② — 전체 일괄 배정
// ═══════════════════════════════════════════════════════════════════════════

/**
 * "다음 모임 전까지 책 1챕터" 처럼 **같은 일을 전원에게** 줄 때.
 * ★ 할일 row 를 멤버 수만큼 만든다 (1개가 아니다).
 *   각자 자기 진행률·자기 댓글·자기 완료 시각을 가져야 하니까.
 */
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
    // 회색 배경으로 "이건 개별 행과 다른 도구"임을 시각적으로 분리
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
        {/* 버튼 라벨에 인원수를 박아 결과를 미리 알려준다 */}
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

// ═══════════════════════════════════════════════════════════════════════════
// 할일 배정 방식 ③ — 기존 할일 불러오기 (다중 선택 패널)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 워크스페이스의 기존 할일을 골라 이 회의록에 연결한다.
 * 선택된 행은 keep 으로 넘어가고, syncTasksForNote 가 note_id 를 강제로
 * 이 노트로 바꾼다 (= 다른 회의록에 있던 것도 이쪽으로 옮겨온다).
 */
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
        {/* 목록이 길어져도 패널 높이는 고정 — 내부 스크롤 */}
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
                  {/* 사각 체크 — 선택 시 액센트로 채움 */}
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
                    {/* 이미 다른 회의록에 물려 있으면 미리 알려준다 */}
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

// ═══════════════════════════════════════════════════════════════════════════
// 폼 레이아웃 조각
// ═══════════════════════════════════════════════════════════════════════════

/** 폼 섹션 — 제목 + 얇은 밑줄 + (선택) 부제. 섹션 사이는 space-y-12. */
function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
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

/** 라벨 + 컨트롤 세로 스택. */
function Stacked({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-1 text-xs text-foreground-faint">{hint}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 헬퍼
// ═══════════════════════════════════════════════════════════════════════════

function emptyAction(): ActionItemDraft {
  return { id: null, title: "", assignee_id: null, due_date: "" };
}

/**
 * 제목 자동 생성 — 폼에 제목 입력칸이 없는 이유.
 *  · 일정에 연결되어 있으면 그 일정 제목을 그대로
 *  · 단독 회의록이면 "YYYY-MM-DD 회의록"
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

// ═══════════════════════════════════════════════════════════════════════════
// 수동 임시저장  (원본: src/lib/use-draft.ts + src/features/common/draft-bar.tsx)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * **자동 저장 안 함** — save(snapshot) 를 명시적으로 부를 때만 저장한다.
 * 자동 저장은 "내가 저장했나?"를 모호하게 만들고 실수로 지운 내용까지 덮어쓴다.
 */
function useDraft<T>(key: string | null) {
  const [draft] = useState<T | null>(() => {
    if (!key || typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  });
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const save = useCallback(
    (value: T) => {
      if (!key) return;
      try {
        localStorage.setItem(key, JSON.stringify(value));
        setSavedAt(Date.now());
      } catch {
        /* quota / private mode — 무시 */
      }
    },
    [key],
  );

  const clear = useCallback(() => {
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch {
      /* 무시 */
    }
  }, [key]);

  return { draft, save, clear, savedAt };
}

/** 폼 상단: 임시저장본이 있을 때만 뜨는 복원/삭제 배너. */
function DraftRestoreBanner({
  onRestore,
  onDiscard,
}: {
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border border-line bg-surface-muted px-4 py-2.5 text-xs">
      <span className="text-foreground-muted">임시저장된 내용이 있어요.</span>
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

/** 폼 하단: 수동 임시저장 버튼 + "임시저장됨" 표시. */
function DraftSaveButton({
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
