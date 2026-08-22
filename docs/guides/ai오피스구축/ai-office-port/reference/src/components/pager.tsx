/**
 * 페이지 넘기기 — "< 1/N >" 형식. 전체 페이지가 1이면 렌더 안 함.
 *
 * 사용:
 *   const [page, setPage] = useState(1);
 *   const sliced = paginate(items, page, PAGE_SIZE);
 *   <Pager page={page} total={items.length} pageSize={PAGE_SIZE} onChange={setPage} />
 */

type Props = {
  page: number;
  total: number;
  pageSize: number;
  onChange: (next: number) => void;
};

export function Pager({ page, total, pageSize, onChange }: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // 1쪽이어도 1/1 로 노출 (이전/다음은 disabled).
  const prev = Math.max(1, page - 1);
  const next = Math.min(pageCount, page + 1);
  return (
    <nav
      aria-label="페이지"
      className="flex items-center justify-center gap-4 pt-8"
    >
      <button
        type="button"
        onClick={() => onChange(prev)}
        disabled={page <= 1}
        aria-label="이전 페이지"
        className="text-foreground-muted hover:text-foreground disabled:opacity-30 disabled:hover:text-foreground-muted text-sm w-7 h-7 flex items-center justify-center"
      >
        ‹
      </button>
      <span className="text-xs text-foreground-muted tabular-nums">
        {page} / {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onChange(next)}
        disabled={page >= pageCount}
        aria-label="다음 페이지"
        className="text-foreground-muted hover:text-foreground disabled:opacity-30 disabled:hover:text-foreground-muted text-sm w-7 h-7 flex items-center justify-center"
      >
        ›
      </button>
    </nav>
  );
}

/** Slice helper — 1-based page. */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export const PAGE_SIZE = 20;
