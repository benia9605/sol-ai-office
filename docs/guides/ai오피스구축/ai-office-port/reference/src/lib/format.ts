const dateFmt = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});

const dateShortFmt = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// 게시물/댓글 타임스탬프용 — 날짜 + 시간(분). 요일 없이 간결하게.
const dateTimeFmt = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const shortDateTimeFmt = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatFullDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return dateFmt.format(d);
}

export function formatShortDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return dateShortFmt.format(d);
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return timeFmt.format(d);
}

/** 게시물/댓글용 — "2026년 6월 21일 14:30". */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return dateTimeFmt.format(d);
}

/** 리스트용 간결 버전 — "6월 21일 14:30". */
export function formatShortDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return shortDateTimeFmt.format(d);
}

export function formatMonthDay(date: Date | string): {
  month: string;
  day: string;
  weekday: string;
} {
  const d = typeof date === "string" ? new Date(date) : date;
  const month = new Intl.DateTimeFormat("en-US", { month: "short" })
    .format(d)
    .toUpperCase();
  const day = String(d.getDate()).padStart(2, "0");
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(d);
  return { month, day, weekday };
}
