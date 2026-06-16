import { NavLink } from "react-router";

type Props = {
  moreOpen: boolean;
  onToggleMore: () => void;
};

/**
 * Fixed bottom navigation shown only on mobile (sm:hidden). 4개의 자주
 * 쓰는 항목 + 더보기 버튼 (전체 메뉴 시트 토글). pb-safe-bottom 으로
 * iOS 홈 인디케이터 회피.
 */
export function MobileBottomNav({ moreOpen, onToggleMore }: Props) {
  return (
    <nav
      aria-label="모바일 빠른 이동"
      className="sm:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-line bg-surface pb-safe-bottom"
    >
      <ul className="grid grid-cols-5">
        <BottomItem to="/dashboard" label="홈" icon={HomeIcon} end />
        <BottomItem to="/meetings" label="일정" icon={CalendarIcon} />
        <BottomItem to="/readings" label="챌린지" icon={ChallengeIcon} />
        <BottomItem to="/tasks" label="할일" icon={CheckIcon} />
        <li>
          <button
            type="button"
            onClick={onToggleMore}
            aria-expanded={moreOpen}
            aria-label="더보기"
            className={`w-full flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] tracking-wider transition-colors min-h-[56px] ${
              moreOpen
                ? "text-accent-teal"
                : "text-foreground-muted hover:text-foreground"
            }`}
          >
            <MoreIcon className="w-5 h-5" />
            <span>더보기</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

function BottomItem({
  to,
  label,
  icon: Icon,
  end = false,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          `flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] tracking-wider transition-colors min-h-[56px] ${
            isActive
              ? "text-accent-teal"
              : "text-foreground-muted hover:text-foreground"
          }`
        }
      >
        <Icon className="w-5 h-5" />
        <span>{label}</span>
      </NavLink>
    </li>
  );
}

// ───────────────────────────────────────────────────────────────
// Icons
// ───────────────────────────────────────────────────────────────

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9.5" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="16" rx="1" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function ChallengeIcon({ className }: { className?: string }) {
  // 책+불꽃 무드 — 챌린지 / 도전
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 5a2 2 0 012-2h7v18H6a2 2 0 01-2-2V5z" />
      <path d="M13 3h5a2 2 0 012 2v14a2 2 0 01-2 2h-5" />
      <path d="M7 8h3M7 12h3" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6h11M4 12h7M4 18h11" />
      <path d="M17 13l2 2 4-4" />
    </svg>
  );
}

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </svg>
  );
}
