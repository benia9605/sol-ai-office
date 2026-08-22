/**
 * 회의록 카드/리스트의 한 줄 미리보기 텍스트.
 * 우선순위: 아젠다 앞 3개 → 본문 첫 줄 (마크다운 마커 정제).
 */
export function notePreview(note: {
  agenda: string | null;
  content: string | null;
}): string | null {
  return agendaPreview(note.agenda) ?? bodyFirstLine(note.content);
}

/** 줄바꿈으로 나누고 머리표 제거 후 앞 3개를 ' · ' 로 묶기. */
export function agendaPreview(agenda: string | null): string | null {
  if (!agenda) return null;
  const items = agenda
    .split("\n")
    .map((s) => stripMarkers(s).trim())
    .filter(Boolean);
  if (items.length === 0) return null;
  return items.slice(0, 3).join(" · ");
}

/** 본문의 첫 의미있는 줄을 md/html 마커 제거한 평문으로. */
export function bodyFirstLine(content: string | null): string | null {
  if (!content) return null;
  // HTML 태그 떼기 (RichEditor 가 HTML 저장하는 경우 대비)
  const stripped = content.replace(/<[^>]+>/g, " ");
  const lines = stripped
    .split("\n")
    .map((s) => stripMarkers(stripInline(s)).trim())
    .filter(Boolean);
  return lines[0] ?? null;
}

/** 줄 앞쪽의 #, -, *, •, 1., > 같은 머리표 제거. */
function stripMarkers(s: string): string {
  return s.replace(/^\s*(?:#{1,6}\s+|[-*•+]\s+|\d+[.)]\s+|>\s+)/, "");
}

/** 인라인 마크다운 마커 제거 (bold/italic/code/link 등). */
function stripInline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold**
    .replace(/__([^_]+)__/g, "$1") // __bold__
    .replace(/\*([^*]+)\*/g, "$1") // *italic*
    .replace(/(?:^|\s)_([^_]+)_(?=\s|$)/g, " $1") // _italic_
    .replace(/`([^`]+)`/g, "$1") // `code`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url) → text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "") // ![alt](url) → (drop)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
