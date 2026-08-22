/* ============================================================================
 * 화면 ③ — 할일 상세 (편집 모드)   (라우트: /tasks/:id — URL 은 그대로)
 * ============================================================================
 *
 * 뷰어(02)에서 [편집] 을 누르면 **같은 페이지 안에서** 이 폼으로 바뀐다.
 * 새 URL 도 아니고, 팝업/모달도 아니다. 원본은 한 파일 안의 mode state 전환:
 *
 *     const [mode, setMode] = useState<"view" | "edit">("view");
 *     {mode === "view" ? <ViewMode … /> : <EditMode … />}
 *
 * 밋업 원본을 한 파일로 합친 디자인 참고본.
 *   src/pages/task-detail.tsx                       ← EditMode
 *   src/lib/use-draft.ts                            ← 수동 임시저장 훅 (아래 useDraft)
 *   src/features/common/draft-bar.tsx               ← 배너/버튼 (아래 두 컴포넌트)
 *   src/features/auth/_shared.tsx                   ← inputClass 등 (아래 상수)
 *   src/features/editor/rich-editor.tsx             ← RichEditor (import 유지)
 *   src/features/attachments/attachments-section.tsx ← 첨부 (import 유지)
 *
 * ─── 화면 스케치 ────────────────────────────────────────────────────────────
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ 임시저장된 내용이 있어요.            불러오기   삭제           │ ← 있을 때만
 *   └──────────────────────────────────────────────────────────────┘
 *
 *   EDITING TASK                              ← .label (영문 대문자 트래킹)
 *   예산안 초안 작성______________________     ← 제목: 밑줄 인풋인데 h1 크기 그대로
 *
 *   담당자                    기한
 *   김대표 ▾__________        2026-08-24__     ← 밑줄만 있는 인풋 (박스 아님)
 *
 *   회의록 연결
 *   3분기 전략 회의 ▾_________________________
 *
 *   내용
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ B I S │ H1 H2 H3 │ A H │ · 1. ☑ │ " <|> │ 🔗 🖼 ▶ HTML │…│ ← sticky 툴바
 *   ├──────────────────────────────────────────────────────────────┤
 *   │ (본문 입력 영역 — minHeight 280)                              │
 *   └──────────────────────────────────────────────────────────────┘
 *
 *   첨부 · 2                                        + 파일 추가
 *   기획안_v3.pdf         1.2 MB · application/pdf        삭제
 *
 *                  [취소] [임시저장] [수정 저장] [수정 + 할일 완료]
 *
 * ─── 디자인 규칙 ────────────────────────────────────────────────────────────
 *  · 입력칸은 박스가 아니라 **밑줄**(border-b). 화면에 사각형이 늘어나지 않는다.
 *    포커스 시 밑줄만 진해짐(`focus:border-foreground`), 파란 아웃라인 없음.
 *  · 제목 인풋은 뷰 모드의 h1 과 같은 크기 — 편집 전후로 글자가 튀지 않는다.
 *  · 버튼 순서는 왼→오른쪽으로 "되돌리기 → 보류 → 저장 → 저장+완료".
 *    가장 오른쪽(=엄지에 가장 가까운 곳)이 가장 자주 쓰는 액션.
 *  · 「수정 + 할일 완료」를 반드시 둔다. 실제 흐름이 "결과를 적고 완료 처리"인데
 *    저장 후 완료 버튼을 다시 찾게 하면 마찰이 크다.
 *  · 임시저장은 **자동 저장 안 함**. 버튼을 누른 순간만 localStorage 에.
 *  · 편집 모드에선 첨부가 canManage 로 열린다 (뷰 모드는 read-only).
 *  · 편집 중엔 좋아요·댓글 블록을 렌더하지 않는다.
 * ========================================================================== */

import { useCallback, useState, type FormEvent } from "react";
import { updateTask, type TaskPatch } from "@/lib/data/tasks";
import { RichEditor } from "@/features/editor/rich-editor";
import { AttachmentsSection } from "@/features/attachments/attachments-section";
import type { Task } from "@/lib/types/database";
import type { MemberWithProfile } from "@/lib/data/workspace-members";
import type { MeetingNote } from "@/lib/types/database";

// ═══════════════════════════════════════════════════════════════════════════
// 공통 폼 스타일  (원본: src/features/auth/_shared.tsx)
// ═══════════════════════════════════════════════════════════════════════════

/** 밑줄만 있는 인풋. 박스 없음 · 그림자 없음 · 포커스 시 밑줄만 진해짐. */
export const inputClass =
  "w-full border-b border-line-strong px-0 py-2 text-sm focus:border-foreground focus:outline-none bg-transparent placeholder:text-foreground-faint";

/** 필드 라벨 — 작고 흐린 회색. */
export const labelClass = "text-xs text-foreground-muted";

/** 에러 박스 — danger 배경/테두리. */
export const errorBox =
  "border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger";

// ═══════════════════════════════════════════════════════════════════════════
// 편집 폼
// ═══════════════════════════════════════════════════════════════════════════

type TaskDraft = {
  title: string;
  assigneeId: string | null;
  dueDate: string;
  description: string;
  noteId: string | null;
};

export function EditMode({
  task,
  workspaceId,
  members,
  notes,
  canManage,
  userId,
  onCancel,
  onSaved,
}: {
  task: Task;
  workspaceId: string;
  members: MemberWithProfile[];
  /** 워크스페이스 전체 회의록 — 연결 셀렉트용 */
  notes: MeetingNote[];
  canManage: boolean;
  userId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  // 수동 임시저장 — 자동 저장 안 함. 실제 task 값에서 시작하고,
  // 임시저장본이 있으면 상단 배너로 불러올 수 있게 한다.
  // 키는 반드시 문서 + 사용자별로 분리 (공용 키면 남의 초안이 튀어나온다).
  const { draft, save: saveDraft, clear: clearDraftStore, savedAt } =
    useDraft<TaskDraft>(`task-draft:${task.id}:${userId}`);
  const [restored, setRestored] = useState(false);

  const [title, setTitle] = useState(task.title);
  const [assigneeId, setAssigneeId] = useState<string | null>(task.assignee_id);
  const [dueDate, setDueDate] = useState<string>(
    // 날짜만 있는 필드는 slice(0,10) 이 맞다.
    // (시각이 포함된 datetime-local 은 slice 하면 9시간 밀린다 — 06 문서 참고)
    task.due_date ? task.due_date.slice(0, 10) : "",
  );
  const [description, setDescription] = useState(task.description ?? "");
  const [noteId, setNoteId] = useState<string | null>(task.note_id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyDraft() {
    if (!draft) return;
    setTitle(draft.title);
    setAssigneeId(draft.assigneeId);
    setDueDate(draft.dueDate);
    setDescription(draft.description);
    setNoteId(draft.noteId);
    setRestored(true);
  }
  function saveDraftNow() {
    saveDraft({ title, assigneeId, dueDate, description, noteId });
  }

  async function persist(opts: { complete: boolean }): Promise<boolean> {
    if (!title.trim()) {
      setError("제목은 필수입니다.");
      return false;
    }
    setBusy(true);
    setError(null);
    const patch: TaskPatch = {
      title: title.trim(),
      assignee_id: assigneeId,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      // 빈 본문은 null 로 정규화 — 빈 <p></p> 가 DB 에 쌓이지 않게
      description: description.trim() ? description : null,
      note_id: noteId,
    };
    if (opts.complete) patch.status = "done";

    // ★ actorId 를 반드시 넘긴다. 안 넘기면 담당자가 완료한 것으로 기록되고
    //   "본인 제외" 알림 필터도 엉뚱하게 걸린다.
    //   완료로 전환되면 updateTask 안에서 활동 피드 + 전체 알림 자동 발송.
    const updated = await updateTask(task.id, patch, { actorId: userId });
    if (!updated) {
      setError("저장에 실패했습니다.");
      setBusy(false);
      return false;
    }
    clearDraftStore(); // 실제 저장 성공 → 임시저장본 폐기
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await persist({ complete: false });
    if (ok) onSaved();
  }

  async function handleSubmitAndComplete() {
    const ok = await persist({ complete: true });
    if (ok) onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* ── 임시저장 복원 배너 — 저장본이 있고 아직 안 불러왔을 때만 ──── */}
      {draft && !restored && (
        <DraftRestoreBanner
          onRestore={applyDraft}
          onDiscard={() => {
            clearDraftStore();
            setRestored(true);
          }}
        />
      )}

      {/* ── 제목 — 뷰 모드 h1 과 같은 크기의 밑줄 인풋 ─────────────────── */}
      <header>
        <p className="label">Editing Task</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`${inputClass} mt-3 text-2xl font-light !py-2 sm:text-3xl`}
          placeholder="제목"
        />
      </header>

      {/* ── 담당자 · 기한 — 모바일 1열 / 데스크탑 2열 ────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>담당자</label>
          <select
            value={assigneeId ?? ""}
            onChange={(e) => setAssigneeId(e.target.value || null)}
            className={`${inputClass} mt-2`}
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
            className={`${inputClass} mt-2`}
          />
        </div>
      </section>

      {/* ── 회의록 연결 — "연결 안 함" 을 첫 옵션으로 명시 ─────────────── */}
      <div>
        <label className={labelClass}>회의록 연결</label>
        <select
          value={noteId ?? ""}
          onChange={(e) => setNoteId(e.target.value || null)}
          className={`${inputClass} mt-2`}
          aria-label="연결할 회의록"
        >
          <option value="">— 연결 안 함 —</option>
          {notes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </select>
      </div>

      {/* ── 본문 에디터 ──────────────────────────────────────────────
          툴바는 sticky — 본문이 길어져도 항상 보인다.
          붙여넣기: 유튜브 URL → 임베드 / 마크다운 → HTML 변환 / HTML → 그대로.
          전체 구현: reference/src/features/editor/rich-editor.tsx */}
      <div>
        <label className={labelClass}>내용</label>
        <div className="mt-2">
          <RichEditor
            value={description}
            onChange={setDescription}
            placeholder="과제 설명 / 참고 자료 / 체크리스트 등."
            minHeight={280}
          />
        </div>
      </div>

      {/* ── 첨부 — 편집 모드에선 추가/삭제 가능 ────────────────────────── */}
      <AttachmentsSection
        workspaceId={workspaceId}
        refType="task"
        refId={task.id}
        canManage={canManage}
      />

      {error && <p className={errorBox}>{error}</p>}

      {/* ── 하단 버튼 — 취소 · 임시저장 · 수정저장 · 수정+완료 순 ──────── */}
      <footer className="flex flex-wrap items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="border border-line-strong px-5 py-2.5 text-sm hover:border-foreground disabled:opacity-60"
        >
          취소
        </button>
        <DraftSaveButton onSave={saveDraftNow} savedAt={savedAt} disabled={busy} />
        {/* 저장 — 액센트를 옅게 깐 중간 무게 */}
        <button
          type="submit"
          disabled={busy}
          className="border border-accent-teal/40 bg-accent-teal/15 px-5 py-2.5 text-sm text-foreground hover:bg-accent-teal/25 hover:border-accent-teal/60 disabled:opacity-60"
        >
          {busy ? "저장 중..." : "수정 저장"}
        </button>
        {/* 저장 + 완료 — 액센트 채움. 이미 완료된 할일이면 숨긴다 */}
        {task.status !== "done" && (
          <button
            type="button"
            onClick={handleSubmitAndComplete}
            disabled={busy}
            className="border border-accent-teal bg-accent-teal px-5 py-2.5 text-sm text-accent-foreground hover:bg-accent-teal/85 disabled:opacity-60"
          >
            수정 + 할일 완료
          </button>
        )}
      </footer>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 수동 임시저장  (원본: src/lib/use-draft.ts + src/features/common/draft-bar.tsx)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 수동 임시저장(localStorage) 훅. **자동 저장 안 함** —
 * 폼에서 save(snapshot) 를 명시적으로 호출할 때만 저장한다.
 *
 *  · draft   : 마운트 시점에 발견된 임시저장본 (없으면 null)
 *  · save()  : 현재 스냅샷 저장 + savedAt 갱신
 *  · clear() : 실제 저장 성공 시 폐기
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
