import { Link } from "react-router";
import { formatMonthDay, formatTime } from "@/lib/format";
import type { MeetingType } from "@/lib/types/database";

type Meeting = {
  id: string;
  title: string;
  location: string | null;
  starts_at: string;
  type_id: string | null;
};

type Props = {
  meetings: Meeting[];
  typesById?: Map<string, MeetingType>;
  /** Optional section title — defaults to "다가오는 일정". */
  title?: string;
  /** Empty state message. */
  emptyMessage?: string;
};

export function UpcomingList({
  meetings,
  typesById,
  title = "다가오는 일정",
  emptyMessage = "예정된 일정이 없습니다.",
}: Props) {
  return (
    <section>
      <SectionHeader title={title} href="/meetings" />
      {meetings.length === 0 ? (
        <EmptyRow message={emptyMessage} />
      ) : (
        <ul className="divide-y divide-line border-b border-line">
          {meetings.map((m) => {
            const { month, day, weekday } = formatMonthDay(m.starts_at);
            const time = formatTime(m.starts_at);
            const t = m.type_id ? typesById?.get(m.type_id) ?? null : null;
            return (
              <li key={m.id}>
                <Link
                  to={`/meetings/${m.id}`}
                  className="grid grid-cols-[88px_1fr_auto] items-center gap-6 py-6 hover:bg-surface-muted px-2 -mx-2 transition-colors"
                >
                  <div className="border-r border-line pr-6">
                    <p className="text-xs text-foreground-faint">{month}</p>
                    <p className="mt-1 text-3xl font-light leading-none tabular-nums">
                      {day}
                    </p>
                    <p className="mt-2 text-xs text-foreground-faint">
                      {weekday}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {t && (
                        <span
                          aria-hidden
                          className="rounded-full shrink-0"
                          style={{
                            backgroundColor: t.color,
                            width: 8,
                            height: 8,
                          }}
                        />
                      )}
                      <p className="text-base truncate">{m.title}</p>
                    </div>
                    <p className="mt-1.5 text-xs text-foreground-muted truncate">
                      {t ? `${t.name}` : null}
                      {t && m.location ? " · " : null}
                      {m.location}
                    </p>
                  </div>
                  <span className="text-xs text-foreground-faint shrink-0">
                    {time}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function SectionHeader({
  title,
  href,
  cta = "전체 보기",
}: {
  title: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-line pb-3">
      <h2 className="text-base">{title}</h2>
      {href && (
        <Link
          to={href}
          className="text-xs text-foreground-muted hover:text-foreground"
        >
          {cta} →
        </Link>
      )}
    </div>
  );
}

export function EmptyRow({ message }: { message: string }) {
  return (
    <div className="border-b border-line py-12 text-center">
      <p className="text-sm text-foreground-faint">{message}</p>
    </div>
  );
}
