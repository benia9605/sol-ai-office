import { Link, Navigate } from "react-router";
import { useAuth } from "@/lib/auth-context";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { useAsync } from "@/lib/use-async";
import { getWorkspaceInsights } from "@/lib/data/insights";
import { getWorkspaceNotes } from "@/lib/data/meeting-notes";
import { getWorkspaceWritings } from "@/lib/data/writings";
import { getMyReadingNotes } from "@/lib/data/readings";
import { getTasks } from "@/lib/data/tasks";
import { getMyVisionBoards } from "@/lib/data/vision-boards";
import { InsightCard } from "@/components/insight-card";
import { WritingCard } from "@/components/writing-card";
import { ReadingNoteBadges } from "@/features/readings/reading-note-badges";
import { formatShortDate, formatShortDateTime } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  todo: "대기",
  in_progress: "진행 중",
  done: "완료",
};

export function MePostsPage() {
  const { user } = useAuth();
  const { workspace, loading: wsLoading } = useActiveWorkspace();

  const { data: insights } = useAsync(
    () =>
      workspace && user
        ? getWorkspaceInsights(workspace.id, user.id)
        : Promise.resolve([]),
    [workspace?.id, user?.id],
  );
  const { data: notes } = useAsync(
    () =>
      workspace ? getWorkspaceNotes(workspace.id) : Promise.resolve([]),
    [workspace?.id],
  );
  const { data: writings } = useAsync(
    () =>
      workspace && user
        ? getWorkspaceWritings(workspace.id, user.id)
        : Promise.resolve([]),
    [workspace?.id, user?.id],
  );
  const { data: readingNotes } = useAsync(
    () =>
      workspace && user
        ? getMyReadingNotes(workspace.id, user.id)
        : Promise.resolve([]),
    [workspace?.id, user?.id],
  );
  const { data: myTasks } = useAsync(
    () =>
      workspace && user
        ? getTasks({ workspaceId: workspace.id, assigneeId: user.id })
        : Promise.resolve([]),
    [workspace?.id, user?.id],
  );
  const { data: myBoards } = useAsync(
    () => (user ? getMyVisionBoards(user.id) : Promise.resolve([])),
    [user?.id],
  );

  if (wsLoading) return null;
  if (!user || !workspace) return <Navigate to="/dashboard" replace />;

  const myInsights = (insights ?? []).filter((i) => i.user_id === user.id);
  const myWritings = (writings ?? []).filter((w) => w.user_id === user.id);
  const myNotes = (notes ?? []).filter((n) => n.created_by === user.id);

  const draftInsights = myInsights.filter((i) => i.status === "draft");
  const publishedInsights = myInsights.filter((i) => i.status !== "draft");
  const draftWritings = myWritings.filter((w) => w.status === "draft");
  const publishedWritings = myWritings.filter((w) => w.status !== "draft");
  const draftCount = draftInsights.length + draftWritings.length;

  const tasks = myTasks ?? [];
  const openTasks = tasks.filter((t) => t.status !== "done");
  const boards = myBoards ?? [];

  return (
    <div className="space-y-14">
      <header className="border-b border-line pb-6">
        <p className="label">My Page</p>
        <h1 className="mt-3 text-3xl font-light">내 활동</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          오늘까지 쌓아온 것, 내일 한 걸음 더.
        </p>
      </header>

      {draftCount > 0 && (
        <section>
          <div className="flex items-baseline justify-between border-b border-line pb-3">
            <h2 className="text-base">
              임시저장 ·{" "}
              <span className="text-accent-teal">{draftCount}</span>
            </h2>
            <p className="text-xs text-foreground-faint">
              본인만 볼 수 있어요
            </p>
          </div>
          <ul className="divide-y divide-line border-b border-line">
            {draftWritings.map((w) => (
              <li key={`w-${w.id}`}>
                <Link
                  to={`/writings/${w.id}`}
                  className="flex items-baseline justify-between gap-3 py-3 px-2 hover:bg-surface-muted transition-colors"
                >
                  <span className="flex-1 min-w-0 truncate text-sm">
                    <span className="text-[10px] tracking-widest uppercase text-foreground-faint mr-2">
                      글쓰기
                    </span>
                    {w.title || "(제목 없음)"}
                  </span>
                  <span className="shrink-0 text-xs text-foreground-faint">
                    {formatShortDateTime(w.updated_at)}
                  </span>
                </Link>
              </li>
            ))}
            {draftInsights.map((i) => (
              <li key={`i-${i.id}`}>
                <Link
                  to={`/insights/${i.id}`}
                  className="flex items-baseline justify-between gap-3 py-3 px-2 hover:bg-surface-muted transition-colors"
                >
                  <span className="flex-1 min-w-0 truncate text-sm">
                    <span className="text-[10px] tracking-widest uppercase text-foreground-faint mr-2">
                      인사이트
                    </span>
                    {i.title || "(제목 없음)"}
                  </span>
                  <span className="shrink-0 text-xs text-foreground-faint">
                    {formatShortDateTime(i.updated_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-5 flex items-baseline justify-between border-b border-line pb-3">
          <h2 className="text-base">
            글쓰기 · {publishedWritings.length}
          </h2>
          <Link
            to="/writings/new"
            className="text-xs text-foreground-muted hover:text-foreground"
          >
            + 새 글 →
          </Link>
        </div>
        {publishedWritings.length === 0 ? (
          <p className="border-b border-line py-12 text-center text-sm text-foreground-faint">
            아직 발행한 글이 없습니다.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {publishedWritings.map((w) => (
              <li key={w.id}>
                <WritingCard writing={w} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-5 flex items-baseline justify-between border-b border-line pb-3">
          <h2 className="text-base">
            인사이트 · {publishedInsights.length}
          </h2>
          <Link
            to="/insights/new"
            className="text-xs text-foreground-muted hover:text-foreground"
          >
            + 새 인사이트 →
          </Link>
        </div>
        {publishedInsights.length === 0 ? (
          <p className="border-b border-line py-12 text-center text-sm text-foreground-faint">
            아직 발행한 인사이트가 없습니다.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {publishedInsights.map((i) => (
              <li key={i.id}>
                <InsightCard insight={i} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between border-b border-line pb-3">
          <h2 className="text-base">회의록 · {myNotes.length}</h2>
          <Link
            to="/notes/new"
            className="text-xs text-foreground-muted hover:text-foreground"
          >
            + 새 회의록 →
          </Link>
        </div>
        {myNotes.length === 0 ? (
          <p className="border-b border-line py-12 text-center text-sm text-foreground-faint">
            아직 작성한 회의록이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-line border-b border-line">
            {myNotes.map((n) => (
              <li key={n.id}>
                <Link
                  to={`/notes/${n.id}`}
                  className="block py-4 hover:bg-surface-muted -mx-2 px-2 transition-colors"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm">{n.title}</p>
                    <span className="text-xs text-foreground-faint shrink-0">
                      {formatShortDateTime(n.created_at)}
                    </span>
                  </div>
                  {(n.summary || firstLine(n.content)) && (
                    <p className="mt-1 text-xs text-foreground-muted line-clamp-2">
                      {n.summary || firstLine(n.content)}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between border-b border-line pb-3">
          <h2 className="text-base">
            챌린지 노트 · {(readingNotes ?? []).length}
          </h2>
          <Link
            to="/readings"
            className="text-xs text-foreground-muted hover:text-foreground"
          >
            챌린지로 →
          </Link>
        </div>
        {(readingNotes ?? []).length === 0 ? (
          <p className="border-b border-line py-12 text-center text-sm text-foreground-faint">
            아직 작성한 챌린지 노트가 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-line border-b border-line">
            {(readingNotes ?? []).map((n) => {
              const previewSource =
                (typeof n.raw_text === "string" && n.raw_text.trim()) ||
                n.external_excerpt ||
                n.external_title ||
                "";
              const preview = previewSource.replace(/<[^>]+>/g, " ").trim();
              const isExternal = n.source_type === "external_blog";
              const title =
                (n.title && n.title.trim()) || "(제목 없음)";
              return (
                <li key={n.id}>
                  <Link
                    to={`/readings/${n.reading_id}/notes/${n.id}`}
                    className="block py-4 hover:bg-surface-muted -mx-2 px-2 transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium truncate">{title}</p>
                      <span className="text-xs text-foreground-faint shrink-0">
                        {formatShortDateTime(n.created_at)}
                      </span>
                    </div>
                    {n.reading && (
                      <div className="mt-1.5">
                        <ReadingNoteBadges
                          category={n.reading.category}
                          readingTitle={n.reading.title}
                          coverEmoji={n.reading.cover_emoji}
                          chapter={n.chapter}
                          isExternal={isExternal}
                        />
                      </div>
                    )}
                    {preview && (
                      <p className="mt-1.5 text-xs text-foreground-muted line-clamp-1">
                        {preview}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between border-b border-line pb-3">
          <h2 className="text-base">할일 · {openTasks.length}</h2>
          <Link
            to="/tasks"
            className="text-xs text-foreground-muted hover:text-foreground"
          >
            전체 할일 →
          </Link>
        </div>
        {tasks.length === 0 ? (
          <p className="border-b border-line py-12 text-center text-sm text-foreground-faint">
            할당된 할일이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-line border-b border-line">
            {tasks.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/tasks/${t.id}`}
                  className="block py-4 hover:bg-surface-muted -mx-2 px-2 transition-colors"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium truncate">
                      <span className="text-[10px] tracking-widest uppercase text-foreground-faint mr-2">
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                      {t.title}
                    </p>
                    <span className="text-xs text-foreground-faint shrink-0">
                      {t.due_date
                        ? `~ ${formatShortDate(t.due_date)}`
                        : formatShortDateTime(t.created_at)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between border-b border-line pb-3">
          <h2 className="text-base">내 비전보드 · {boards.length}</h2>
          <Link
            to="/vision-boards"
            className="text-xs text-foreground-muted hover:text-foreground"
          >
            전체 비전보드 →
          </Link>
        </div>
        {boards.length === 0 ? (
          <p className="border-b border-line py-12 text-center text-sm text-foreground-faint">
            아직 만든 비전보드가 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-line border-b border-line">
            {boards.map((b) => (
              <li key={b.id}>
                <Link
                  to={`/vision-boards/${b.id}`}
                  className="block py-4 hover:bg-surface-muted -mx-2 px-2 transition-colors"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium truncate flex items-baseline gap-2">
                      <span className="truncate">{b.title}</span>
                      {!b.is_public && (
                        <span className="text-[10px] tracking-widest uppercase text-foreground-faint shrink-0">
                          비공개
                        </span>
                      )}
                    </p>
                    <span className="text-xs text-foreground-faint shrink-0">
                      카드 {b.items.length} · {formatShortDateTime(b.updated_at)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function firstLine(content: string | null): string | null {
  if (!content) return null;
  const line = content.split("\n").map((s) => s.trim()).find(Boolean);
  return line ?? null;
}
