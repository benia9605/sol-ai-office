import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "@/lib/auth-context";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { useAsync } from "@/lib/use-async";
import { getWorkspaceInsights } from "@/lib/data/insights";
import { InsightCard } from "@/components/insight-card";
import { Pager, PAGE_SIZE, paginate } from "@/components/pager";

export function InsightsPage() {
  const { user } = useAuth();
  const { workspace, loading: wsLoading } = useActiveWorkspace();
  const [page, setPage] = useState(1);

  const { data: insights, loading } = useAsync(
    () =>
      workspace && user
        ? getWorkspaceInsights(workspace.id, user.id)
        : Promise.resolve([]),
    [workspace?.id, user?.id],
  );

  const list = insights ?? [];
  const myDraftCount = useMemo(
    () =>
      list.filter((i) => i.user_id === user?.id && i.status === "draft")
        .length,
    [list, user?.id],
  );
  // 메인 리스트는 발행된 인사이트만 (본인 draft 는 /me/posts 에서)
  const published = useMemo(
    () => list.filter((i) => i.status !== "draft"),
    [list],
  );

  if (wsLoading) return null;
  if (!workspace || !user) return null;

  return (
    <div className="space-y-10">
      <header className="flex items-end justify-between border-b border-line pb-6 gap-4">
        <div>
          <p className="label">Insights</p>
          <h1 className="mt-3 text-3xl font-light">인사이트</h1>
          <p className="mt-2 text-sm text-foreground-muted">
            한 줄의 깨달음이, 다음 한 발을 만들어요.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {myDraftCount > 0 && (
            <Link
              to="/me/posts"
              className="text-xs text-accent-teal hover:underline underline-offset-4"
            >
              임시저장 {myDraftCount} →
            </Link>
          )}
          <Link
            to="/insights/new"
            className="bg-accent-teal text-accent-foreground px-3 py-1.5 text-xs hover:bg-accent-teal/85 transition-colors"
          >
            + 인사이트 작성
          </Link>
        </div>
      </header>

      {loading ? null : published.length === 0 ? (
        <p className="border-b border-line py-16 text-center text-sm text-foreground-faint">
          아직 공유된 인사이트가 없습니다.
        </p>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2">
            {paginate(published, page, PAGE_SIZE).map((i) => (
              <li key={i.id}>
                <InsightCard insight={i} />
              </li>
            ))}
          </ul>
          <Pager
            page={page}
            total={published.length}
            pageSize={PAGE_SIZE}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
