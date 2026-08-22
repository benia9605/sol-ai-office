import { useMemo } from "react";

/** Anything that can appear as a chip in a calendar cell. */
export type CalendarEvent = {
  id: string;
  /** ISO timestamp; only the date portion is used. */
  date: string;
  title: string;
  color: string;
};

type Props = {
  /** First-of-month for the visible month, local time. */
  visibleMonth: Date;
  onChangeMonth: (next: Date) => void;
  /** Currently selected day (or null to show all). */
  selectedDay: Date | null;
  onSelectDay: (next: Date | null) => void;
  events: CalendarEvent[];
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function MonthCalendar({
  visibleMonth,
  onChangeMonth,
  selectedDay,
  onSelectDay,
  events,
}: Props) {
  const grid = useMemo(() => buildGrid(visibleMonth), [visibleMonth]);
  const todayKey = dayKey(new Date());
  const selectedKey = selectedDay ? dayKey(selectedDay) : null;

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((e) => {
      // 'YYYY-MM-DD' date 만 들어오면 timezone 변환 없이 그대로 사용
      // (writings.written_date 처럼 date column). timestamp 면 local 변환.
      const k =
        typeof e.date === "string" && !e.date.includes("T")
          ? e.date.slice(0, 10)
          : dayKey(new Date(e.date));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    });
    return map;
  }, [events]);

  const monthLabel = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(visibleMonth);

  function prev() {
    onChangeMonth(addMonths(visibleMonth, -1));
  }
  function next() {
    onChangeMonth(addMonths(visibleMonth, 1));
  }
  function today() {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    onChangeMonth(new Date(t.getFullYear(), t.getMonth(), 1));
    onSelectDay(null);
  }

  return (
    <section className="border border-line">
      <header className="flex items-center justify-between px-4 py-3 border-b border-line">
        <p className="text-sm">{monthLabel}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={today}
            className="text-xs text-foreground-muted hover:text-foreground px-2 py-1"
          >
            오늘
          </button>
          <button
            type="button"
            onClick={prev}
            aria-label="이전 달"
            className="border border-line-strong w-7 h-7 text-xs hover:border-foreground"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="다음 달"
            className="border border-line-strong w-7 h-7 text-xs hover:border-foreground"
          >
            ›
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 text-xs text-foreground-faint border-b border-line">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`px-2 py-2 text-center ${
              i === 0
                ? "text-danger"
                : i === 6
                ? "text-accent-teal"
                : ""
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 grid-rows-6 bg-surface-muted gap-px">
        {grid.map((cell) => {
          const k = dayKey(cell.date);
          const dayEvents = byDay.get(k) ?? [];
          const isToday = k === todayKey;
          const isSelected = k === selectedKey;
          const dow = cell.date.getDay();
          const maxVisible = 3;
          const visible = dayEvents.slice(0, maxVisible);
          const overflow = dayEvents.length - visible.length;

          return (
            <button
              key={k}
              type="button"
              onClick={() =>
                onSelectDay(isSelected ? null : new Date(cell.date))
              }
              className={`bg-surface min-h-[84px] sm:min-h-[110px] flex flex-col items-stretch gap-1 p-1.5 sm:p-2 text-left transition-colors ${
                cell.inMonth
                  ? "hover:bg-surface-muted"
                  : "bg-surface-muted text-foreground-faint"
              } ${isSelected ? "ring-1 ring-inset ring-foreground" : ""}`}
            >
              <span
                className={`text-xs ${
                  isToday
                    ? "text-accent-teal font-medium"
                    : dow === 0
                    ? "text-danger"
                    : dow === 6
                    ? "text-accent-teal"
                    : ""
                }`}
              >
                {cell.date.getDate()}
              </span>
              {dayEvents.length > 0 && (
                <ul className="flex flex-col gap-0.5 min-w-0">
                  {visible.map((e) => (
                    <li
                      key={e.id}
                      title={e.title}
                      className="text-[10px] sm:text-xs leading-tight px-1.5 py-0.5 rounded-sm flex items-center gap-1 min-w-0"
                      style={{
                        backgroundColor: tintBg(e.color),
                        color: tintFg(e.color),
                      }}
                    >
                      <span
                        aria-hidden
                        className="rounded-full shrink-0"
                        style={{
                          backgroundColor: e.color,
                          width: 6,
                          height: 6,
                        }}
                      />
                      <span className="truncate">{e.title}</span>
                    </li>
                  ))}
                  {overflow > 0 && (
                    <li className="text-[10px] text-foreground-faint leading-tight px-1.5">
                      +{overflow}건
                    </li>
                  )}
                </ul>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Light tinted background derived from a hex color (macOS Calendar 느낌). */
function tintBg(hex: string): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, 0.14)`;
}

/** Darker foreground from the same hex — mix with black for readability. */
function tintFg(hex: string): string {
  const { r, g, b } = parseHex(hex);
  const k = 0.35;
  const mix = (c: number) => Math.round(c * k);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return {
    r: Number.isFinite(r) ? r : 161,
    g: Number.isFinite(g) ? g : 161,
    b: Number.isFinite(b) ? b : 161,
  };
}

// ───────────────────────────────────────────────────────────────
// helpers
// ───────────────────────────────────────────────────────────────

type Cell = { date: Date; inMonth: boolean };

function buildGrid(visibleMonth: Date): Cell[] {
  const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const startDow = first.getDay();
  const start = new Date(first);
  start.setDate(start.getDate() - startDow);

  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      date: d,
      inMonth: d.getMonth() === visibleMonth.getMonth(),
    });
  }
  return cells;
}

function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
