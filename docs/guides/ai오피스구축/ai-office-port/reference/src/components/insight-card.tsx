import { Link } from "react-router";
import { Avatar } from "@/components/avatar";
import { formatShortDate } from "@/lib/format";
import type { InsightWithMeta } from "@/lib/data/insights";

type Props = {
  insight: InsightWithMeta;
};

export function InsightCard({ insight }: Props) {
  const display = insight.author?.name ?? insight.author?.email ?? "익명";
  const subtitle =
    [insight.author?.company, insight.author?.position]
      .filter(Boolean)
      .join(" · ") || "";

  return (
    <Link
      to={`/insights/${insight.id}`}
      className="h-full flex flex-col border border-line p-6 hover:border-foreground transition-colors"
    >
      <header className="flex items-center gap-3">
        <Avatar url={insight.author?.avatar_url ?? null} name={display} size="md" />
        <div className="min-w-0">
          <p className="text-sm truncate">{display}</p>
          {subtitle && (
            <p className="text-xs text-foreground-muted truncate">{subtitle}</p>
          )}
        </div>
        <span className="ml-auto text-xs text-foreground-faint shrink-0">
          {formatShortDate(insight.created_at)}
        </span>
      </header>

      <div className="flex-1">
        <h3 className="mt-5 text-lg font-medium leading-snug">
          {insight.title}
        </h3>
        {insight.content && (
          <p className="mt-3 text-sm leading-[1.85] text-foreground-muted line-clamp-3">
            {insight.content}
          </p>
        )}

        {insight.tags.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {insight.tags.map((tag) => (
              <li
                key={tag}
                className="text-xs text-foreground-muted border border-line px-2 py-0.5"
              >
                #{tag}
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="mt-5 flex items-center gap-4 border-t border-line pt-4 text-xs text-foreground-muted">
        <span>
          <span className={insight.liked_by_me ? "text-accent-teal" : ""}>
            {insight.liked_by_me ? "♥" : "♡"}
          </span>{" "}
          {insight.like_count}
        </span>
        <span>💬 {insight.comment_count}</span>
        {insight.source && (
          <span className="ml-auto text-foreground-faint truncate">
            출처 · {insight.source}
          </span>
        )}
      </footer>
    </Link>
  );
}
