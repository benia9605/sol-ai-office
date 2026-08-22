import { Link } from "react-router";
import { SectionHeader, EmptyRow } from "./upcoming-list";
import { Avatar } from "@/components/avatar";
import type { ActivityWithActor } from "@/lib/data/activities";

type Props = {
  activities: ActivityWithActor[];
  /** Where the section header "전체 보기 →" link points. */
  href?: string;
  /** Hide the section title bar (for /activity full page). */
  bare?: boolean;
  /** Override the section title. */
  title?: string;
};

export function ActivityFeed({
  activities,
  href = "/activity",
  bare,
  title = "최근 활동",
}: Props) {
  return (
    <section>
      {!bare && <SectionHeader title={title} href={href} />}
      {activities.length === 0 ? (
        <EmptyRow message="아직 기록된 활동이 없습니다." />
      ) : (
        <ul className="divide-y divide-line border-b border-line">
          {activities.map((a) => (
            <li key={a.id}>
              <ActivityRow activity={a} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityRow({ activity }: { activity: ActivityWithActor }) {
  const display = activity.actor?.name ?? activity.actor?.email ?? "익명";
  const verb = verbFor(activity);
  const target = targetTextFor(activity);
  const link = linkFor(activity);
  const time = relativeTime(activity.created_at);
  const reason =
    typeof activity.metadata?.reason === "string"
      ? (activity.metadata.reason as string)
      : null;
  const excerpt =
    typeof activity.metadata?.excerpt === "string"
      ? (activity.metadata.excerpt as string)
      : null;
  const choices =
    typeof activity.metadata?.choices === "string"
      ? (activity.metadata.choices as string)
      : null;
  const subtext = reason ?? excerpt ?? choices;

  const body = (
    <div className="flex items-start gap-3 py-4 -mx-2 px-2 hover:bg-surface-muted transition-colors">
      <Avatar
        url={activity.actor?.avatar_url ?? null}
        name={display}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug truncate">
          <span className="text-foreground">{display}</span>{" "}
          <span className="text-foreground-muted">{verb}</span>
          {target && (
            <>
              {" "}
              <span className="text-foreground">「{target}」</span>
            </>
          )}
          {subtext && (
            <>
              <span aria-hidden className="px-1 text-foreground-faint">
                ·
              </span>
              <span className="text-foreground-muted">「{subtext}」</span>
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-foreground-faint">{time}</p>
      </div>
    </div>
  );

  if (link) {
    return (
      <Link to={link} className="block">
        {body}
      </Link>
    );
  }
  return body;
}

// ───────────────────────────────────────────────────────────────
// Action → verb / link helpers
// ───────────────────────────────────────────────────────────────

function verbFor(a: ActivityWithActor): string {
  switch (a.action) {
    case "created_task":
      return "새 할일을 추가했습니다 ·";
    case "completed_task":
      return "할일을 완료했습니다 ·";
    case "created_meeting":
      return "일정을 등록했습니다 ·";
    case "created_meeting_note":
      return "회의록을 작성했습니다 ·";
    case "shared_insight":
      return "인사이트를 공유했습니다 ·";
    case "liked_insight":
      return "인사이트에 좋아요를 눌렀습니다 ·";
    case "commented_insight":
      return "인사이트에 댓글을 남겼습니다 ·";
    case "created_writing":
      return "글을 발행했습니다 ·";
    case "liked_writing":
      return "글에 좋아요를 눌렀습니다 ·";
    case "commented_writing":
      return "글에 댓글을 남겼습니다 ·";
    case "created_reading_note":
      return "챌린지 노트를 작성했습니다 ·";
    case "liked_reading_note":
      return "챌린지 노트에 좋아요를 눌렀습니다 ·";
    case "commented_reading_note":
      return "챌린지 노트에 댓글을 남겼습니다 ·";
    case "created_reading":
      return "챌린지를 생성했습니다 ·";
    case "liked_reading":
      return "챌린지에 좋아요를 눌렀습니다 ·";
    case "commented_reading":
      return "챌린지에 댓글을 남겼습니다 ·";
    case "completed_reading":
      return "챌린지를 완료했습니다 ·";
    case "created_vision_board":
      return "비전보드를 만들었습니다 ·";
    case "created_agenda":
      return "안건을 올렸습니다 ·";
    case "voted_agenda":
      return "안건에 투표했습니다 ·";
    case "commented_agenda":
      return "안건에 의견을 남겼습니다 ·";
    case "reported_late":
      return "지각을 알렸습니다 ·";
    case "reported_absent":
      return "불참을 알렸습니다 ·";
    case "joined_workspace":
      return "모임에 합류했습니다.";
    default:
      return `${a.action} 활동`;
  }
}

function targetTextFor(a: ActivityWithActor): string | null {
  const t = a.metadata?.title;
  return typeof t === "string" && t.trim() ? t : null;
}

function linkFor(a: ActivityWithActor): string | null {
  if (!a.resource_id) return null;
  switch (a.resource_type) {
    case "insight":
      return `/insights/${a.resource_id}`;
    case "meeting":
      return `/meetings/${a.resource_id}`;
    case "note":
      return `/notes/${a.resource_id}`;
    case "task":
      return `/tasks/${a.resource_id}`;
    case "writing":
      return `/writings/${a.resource_id}`;
    case "reading":
      return `/readings/${a.resource_id}`;
    case "reading_note": {
      // 노트 상세 페이지로 — readingId 가 metadata 에 같이 들어와 있음
      const readingId = a.metadata?.reading_id;
      if (typeof readingId !== "string") return null;
      return `/readings/${readingId}/notes/${a.resource_id}`;
    }
    case "vision_board":
      return `/vision-boards/${a.resource_id}`;
    case "agenda":
      return `/agendas/${a.resource_id}`;
    case "workspace":
      return null;
    default:
      return null;
  }
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  const min = 60;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diffSec < min) return "방금 전";
  if (diffSec < hour) return `${Math.floor(diffSec / min)}분 전`;
  if (diffSec < day) return `${Math.floor(diffSec / hour)}시간 전`;
  if (diffSec < 30 * day) return `${Math.floor(diffSec / day)}일 전`;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}
