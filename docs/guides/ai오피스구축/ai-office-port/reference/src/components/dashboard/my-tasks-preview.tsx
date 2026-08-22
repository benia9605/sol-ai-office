import { Link } from "react-router";
import { SectionHeader, EmptyRow } from "./upcoming-list";
import { formatShortDate } from "@/lib/format";
import type { Task } from "@/lib/types/database";

type Props = {
  tasks: Task[];
};

type Bucket = "overdue" | "today" | "this_week" | "later" | "no_date";
const ORDER: Bucket[] = ["overdue", "today", "this_week", "later", "no_date"];
const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: "지연",
  today: "오늘",
  this_week: "이번 주",
  later: "나중",
  no_date: "기한 없음",
};
const BUCKET_TONE: Record<Bucket, string> = {
  overdue: "text-danger",
  today: "text-accent-teal",
  this_week: "text-foreground",
  later: "text-foreground-muted",
  no_date: "text-foreground-faint",
};

function bucketFor(t: Task): Bucket {
  if (!t.due_date) return "no_date";
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(t.due_date));
  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 7) return "this_week";
  return "later";
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function MyTasksPreview({ tasks }: Props) {
  const open = tasks.filter((t) => t.status !== "done");
  const grouped = new Map<Bucket, Task[]>();
  for (const t of open) {
    const b = bucketFor(t);
    if (!grouped.has(b)) grouped.set(b, []);
    grouped.get(b)!.push(t);
  }

  return (
    <section>
      <SectionHeader
        title="내 할일"
        href="/tasks"
        cta={`전체 ${tasks.length}건`}
      />
      {open.length === 0 ? (
        <EmptyRow message="할당된 할일이 없습니다." />
      ) : (
        <div className="divide-y divide-line border-b border-line">
          {ORDER.filter((b) => (grouped.get(b)?.length ?? 0) > 0).map((b) => (
            <div key={b} className="py-6">
              <p className={`text-xs font-medium ${BUCKET_TONE[b]} mb-4`}>
                {BUCKET_LABEL[b]}
                <span className="ml-1 font-normal text-foreground-faint">
                  · {grouped.get(b)!.length}
                </span>
              </p>
              <ul className="divide-y divide-line/50">
                {grouped.get(b)!.slice(0, 4).map((t) => (
                  <li key={t.id}>
                    <Link
                      to="/tasks"
                      className="grid grid-cols-[1fr_auto] items-center gap-3 py-3 hover:bg-surface-muted -mx-2 px-2 transition-colors"
                    >
                      <p className="text-sm truncate">{t.title}</p>
                      <span
                        className={`text-xs shrink-0 ${
                          b === "overdue" ? "text-danger" : "text-foreground-faint"
                        }`}
                      >
                        {t.due_date ? formatShortDate(t.due_date) : "—"}
                      </span>
                    </Link>
                  </li>
                ))}
                {grouped.get(b)!.length > 4 && (
                  <li>
                    <Link
                      to="/tasks"
                      className="block py-3 -mx-2 px-2 text-xs text-foreground-muted hover:text-foreground"
                    >
                      그 외 {grouped.get(b)!.length - 4}건 →
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
