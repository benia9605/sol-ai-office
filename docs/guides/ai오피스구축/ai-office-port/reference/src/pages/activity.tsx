import { useActiveWorkspace } from "@/lib/active-workspace";
import { useAsync } from "@/lib/use-async";
import { getWorkspaceActivities } from "@/lib/data/activities";
import { ActivityFeed } from "@/components/dashboard/activity-feed";

export function ActivityPage() {
  const { workspace, loading: wsLoading } = useActiveWorkspace();
  const { data: activities, loading } = useAsync(
    () =>
      workspace ? getWorkspaceActivities(workspace.id) : Promise.resolve([]),
    [workspace?.id],
  );

  if (wsLoading || !workspace) return null;

  return (
    <div className="space-y-10">
      <header className="border-b border-line pb-6">
        <p className="label">Activity</p>
        <h1 className="mt-3 text-3xl font-light">활동</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          옆 사람의 발자국. 오늘도 누군가 자라는 중.
        </p>
      </header>
      {loading ? null : (
        <ActivityFeed activities={activities ?? []} bare />
      )}
    </div>
  );
}
