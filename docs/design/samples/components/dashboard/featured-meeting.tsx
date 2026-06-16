import { Link } from "react-router";
import { formatMonthDay, formatTime } from "@/lib/format";
import type { Meeting, MeetingType } from "@/lib/types/database";

type Props = {
  meeting: Pick<
    Meeting,
    "id" | "title" | "description" | "location" | "starts_at" | "type_id"
  >;
  type?: MeetingType | null;
  attendeeCount: number;
};

export function FeaturedMeeting({ meeting, type, attendeeCount }: Props) {
  const { month, day, weekday } = formatMonthDay(meeting.starts_at);
  const time = formatTime(meeting.starts_at);

  return (
    <Link
      to={`/meetings/${meeting.id}`}
      className="group block border border-line hover:border-foreground transition-colors"
    >
      <div className="grid sm:grid-cols-[1fr_1.4fr]">
        <div className="aspect-[4/3] sm:aspect-auto bg-surface-muted relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-5xl font-light tracking-tight">{day}</p>
              <p className="label mt-2">{month}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between p-8 sm:p-10">
          <div>
            <p className="label text-accent-teal">Next Schedule</p>
            <h3 className="mt-4 text-2xl font-light leading-snug">
              {meeting.title}
            </h3>
            {meeting.description && (
              <p className="mt-4 text-sm leading-[1.85] text-foreground-muted line-clamp-3">
                {meeting.description}
              </p>
            )}
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-y-3 gap-x-6 border-t border-line pt-6 text-sm">
            <Detail
              label="일시"
              value={`${month} ${day} (${weekday}) · ${time}`}
            />
            <Detail label="장소" value={meeting.location ?? "장소 미정"} />
            <Detail label="참석 예정" value={`${attendeeCount}명`} />
            <div>
              <dt className="text-xs text-foreground-faint">종류</dt>
              <dd className="mt-1 text-foreground flex items-center gap-2">
                {type ? (
                  <>
                    <span
                      aria-hidden
                      className="rounded-full shrink-0"
                      style={{
                        backgroundColor: type.color,
                        width: 8,
                        height: 8,
                      }}
                    />
                    <span>{type.name}</span>
                  </>
                ) : (
                  <span className="text-foreground-faint">미지정</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </Link>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-foreground-faint">{label}</dt>
      <dd className="mt-1 text-foreground">{value}</dd>
    </div>
  );
}
