import { useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { useAsync } from "@/lib/use-async";
import { getProfile } from "@/lib/data/profile";
import {
  getWorkspaceMeetings,
  getMeetingAttendees,
} from "@/lib/data/meetings";
import { getWorkspaceNotes } from "@/lib/data/meeting-notes";
import { getWorkspaceMembers } from "@/lib/data/workspace-members";
import { getTasks } from "@/lib/data/tasks";
import { getWorkspaceActivities } from "@/lib/data/activities";
import { getWorkspaceMeetingTypes } from "@/lib/data/meeting-types";
import { getHomeNotices } from "@/lib/data/notices";
import { GreetingHero } from "@/components/dashboard/greeting-hero";
import { HomeNotices } from "@/components/dashboard/home-notices";
import { FeaturedMeeting } from "@/components/dashboard/featured-meeting";
import { UpcomingList } from "@/components/dashboard/upcoming-list";
import { RecentMembers } from "@/components/dashboard/recent-members";
import { MyTasksPreview } from "@/components/dashboard/my-tasks-preview";
import { VisionProgressToday } from "@/components/dashboard/vision-progress-today";
import { RecentNotes } from "@/components/dashboard/recent-notes";
import { ActivityFeed } from "@/components/dashboard/activity-feed";

export function DashboardPage() {
  const { user } = useAuth();
  const { workspace, loading: wsLoading } = useActiveWorkspace();

  const { data: profile } = useAsync(
    () => (user ? getProfile(user.id) : Promise.resolve(null)),
    [user?.id],
  );

  // All workspace meetings — we filter to this month + featured client-side.
  const { data: allMeetings } = useAsync(
    () =>
      workspace ? getWorkspaceMeetings(workspace.id) : Promise.resolve([]),
    [workspace?.id],
  );

  const { data: members } = useAsync(
    () =>
      workspace ? getWorkspaceMembers(workspace.id) : Promise.resolve([]),
    [workspace?.id],
  );

  const { data: myTasks } = useAsync(
    () =>
      workspace && user
        ? getTasks({ workspaceId: workspace.id, assigneeId: user.id })
        : Promise.resolve([]),
    [workspace?.id, user?.id],
  );

  const { data: notes } = useAsync(
    () =>
      workspace ? getWorkspaceNotes(workspace.id) : Promise.resolve([]),
    [workspace?.id],
  );

  const { data: activities } = useAsync(
    () =>
      workspace
        ? getWorkspaceActivities(workspace.id, 8)
        : Promise.resolve([]),
    [workspace?.id],
  );

  const { data: meetingTypes } = useAsync(
    () =>
      workspace ? getWorkspaceMeetingTypes(workspace.id) : Promise.resolve([]),
    [workspace?.id],
  );
  const { data: homeNotices } = useAsync(
    () =>
      workspace ? getHomeNotices(workspace.id) : Promise.resolve([]),
    [workspace?.id],
  );
  const typesById = useMemo(
    () => new Map((meetingTypes ?? []).map((t) => [t.id, t])),
    [meetingTypes],
  );

  const meetingsAll = allMeetings ?? [];
  const now = useMemo(() => new Date(), []);

  // Featured = closest upcoming meeting (workspace-wide, any month).
  const featured = useMemo(() => {
    const upcoming = meetingsAll
      .filter((m) => new Date(m.starts_at).getTime() >= now.getTime())
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return upcoming[0] ?? null;
  }, [meetingsAll, now]);

  // 이번 달 일정 — 현재 달의 모든 일정 (시작 시각 기준). featured 는 제외.
  const thisMonth = useMemo(() => {
    const y = now.getFullYear();
    const m = now.getMonth();
    return meetingsAll
      .filter((meeting) => {
        const d = new Date(meeting.starts_at);
        return d.getFullYear() === y && d.getMonth() === m;
      })
      .filter((meeting) => meeting.id !== featured?.id)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }, [meetingsAll, now, featured]);

  const { data: attendeeCount } = useAsync(
    () =>
      featured
        ? getMeetingAttendees(featured.id).then(
            (rows) => rows.filter((r) => r.status === "attending").length,
          )
        : Promise.resolve(0),
    [featured?.id],
  );

  if (wsLoading) return null;

  if (!workspace) {
    return <NoWorkspace />;
  }

  return (
    <div className="space-y-12 sm:space-y-16">
      <div className="space-y-6">
        <GreetingHero name={profile?.name ?? null} />
        <HomeNotices notices={homeNotices ?? []} />
      </div>

      {featured ? (
        <section>
          <FeaturedMeeting
            meeting={featured}
            type={featured.type_id ? typesById.get(featured.type_id) : null}
            attendeeCount={attendeeCount ?? 0}
          />
        </section>
      ) : allMeetings ? (
        <section className="border border-line p-12 sm:p-16 text-center">
          <p className="label">No Upcoming Meeting</p>
          <h2 className="mt-4 text-xl font-light">
            아직 예정된 일정이 없습니다
          </h2>
          <p className="mt-3 text-sm text-foreground-muted">
            새 일정을 만들어 멤버들을 초대해 보세요.
          </p>
        </section>
      ) : null}

      <VisionProgressToday />

      <MyTasksPreview tasks={myTasks ?? []} />

      <UpcomingList
        meetings={thisMonth}
        typesById={typesById}
        title="이번 달 일정"
        emptyMessage="이번 달에 예정된 일정이 없습니다."
      />

      <RecentNotes notes={notes ?? []} />

      <ActivityFeed activities={activities ?? []} />

      <RecentMembers
        members={(members ?? []).map((m) => ({
          user_id: m.profile.user_id,
          name: m.profile.name,
          email: m.profile.email,
          industry: m.profile.industry,
          avatar_url: m.profile.avatar_url,
        }))}
      />

      <footer className="border-t border-line pt-8 pb-4 text-center">
        <p className="text-xs tracking-[0.2em] uppercase text-foreground-faint">
          {workspace.emoji} {workspace.name}
        </p>
      </footer>
    </div>
  );
}

function NoWorkspace() {
  return (
    <div className="border border-line p-12 sm:p-16 text-center max-w-xl mx-auto">
      <p className="label">Not a Member Yet</p>
      <h1 className="mt-4 text-2xl font-light">
        아직 모임 멤버가 아닙니다
      </h1>
      <p className="mt-3 text-sm text-foreground-muted">
        모임장에게 초대를 요청해 주세요.
      </p>
    </div>
  );
}
