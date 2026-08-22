type Props = {
  done: number;
  total: number;
  /** Compact mode for use inside list rows (no box wrapper, smaller text). */
  compact?: boolean;
};

export function TaskProgress({ done, total, compact = false }: Props) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);

  if (compact) {
    return (
      <div>
        <div className="flex items-baseline justify-between gap-2 text-[11px] text-foreground-muted mb-1 tabular-nums">
          <span>
            {done}/{total}
          </span>
          <span className="text-foreground">{pct}%</span>
        </div>
        <div className="h-1 bg-line">
          <div
            className="h-full bg-accent-teal transition-all"
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="border border-accent-teal/40 bg-accent-teal/[0.03] px-4 py-3">
      <div className="flex items-baseline justify-between gap-2 text-xs text-foreground-muted mb-1.5 tabular-nums">
        <span>
          {done}/{total}
        </span>
        <span className="text-foreground">{pct}%</span>
      </div>
      <div className="h-1 bg-line">
        <div
          className="h-full bg-accent-teal transition-all"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}
