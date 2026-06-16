import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router";
import { useAuth, signOut } from "@/lib/auth-context";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { isDemoMode } from "@/lib/demo/mode";
import { BrandMark } from "@/components/brand-mark";
import { Avatar } from "@/components/avatar";
import { JoinFlow } from "@/components/join-flow";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

type NavLeaf = { kind: "leaf"; to: string; label: string };
type NavGroup = {
  kind: "group";
  /** Stable key used to identify the open group. */
  id: string;
  label: string;
  items: { to: string; label: string }[];
};
type NavEntry = NavLeaf | NavGroup;

const NAV: NavEntry[] = [
  { kind: "leaf", to: "/dashboard", label: "홈" },
  {
    kind: "group",
    id: "moim",
    label: "모임",
    items: [
      { to: "/meetings", label: "일정" },
      { to: "/notes", label: "회의록" },
      { to: "/members", label: "멤버" },
    ],
  },
  {
    kind: "group",
    id: "execute",
    label: "실행",
    items: [
      { to: "/projects", label: "프로젝트" },
      { to: "/tasks", label: "할일" },
    ],
  },
  {
    kind: "group",
    id: "content",
    label: "콘텐츠",
    items: [
      { to: "/writings", label: "글쓰기" },
      { to: "/readings", label: "챌린지" },
      { to: "/insights", label: "인사이트" },
      { to: "/vision-boards", label: "비전보드" },
    ],
  },
  {
    kind: "group",
    id: "intro",
    label: "소개",
    items: [
      { to: "/notices", label: "공지사항" },
      { to: "/about", label: "밋업 소개" },
    ],
  },
];

type ProfileItem = { to: string; label: string };

const PROFILE_PRIMARY: ProfileItem[] = [
  { to: "/profile", label: "내 정보 관리" },
  { to: "/me/posts", label: "내 활동" },
];
const PROFILE_SECONDARY: ProfileItem[] = [
  { to: "/stats", label: "활동 리포트" },
];
const PROFILE_ADMIN: ProfileItem[] = [
  { to: "/admin", label: "관리자 메뉴" },
];

function isPathInGroup(pathname: string, group: NavGroup): boolean {
  return group.items.some(
    (it) => pathname === it.to || pathname.startsWith(`${it.to}/`),
  );
}

export function AppLayout() {
  const { user, userProfile, loading } = useAuth();
  const { workspace, loading: wsLoading } = useActiveWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const demo = isDemoMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const megaRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = userProfile?.role === "admin";
  const profileSecondary = isAdmin
    ? [...PROFILE_SECONDARY, ...PROFILE_ADMIN]
    : PROFILE_SECONDARY;

  // Close menus on route change
  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
    setMegaOpen(false);
  }, [location.pathname]);

  // Lock body scroll while mobile panel is open
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  // Outside-click / ESC for desktop profile dropdown
  useEffect(() => {
    if (!profileOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!profileRef.current) return;
      if (!profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [profileOpen]);

  // Outside-click / ESC for desktop mega-menu
  useEffect(() => {
    if (!megaOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!megaRef.current) return;
      if (!megaRef.current.contains(e.target as Node)) {
        setMegaOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMegaOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [megaOpen]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  async function handleSignOut() {
    setMenuOpen(false);
    setProfileOpen(false);
    if (demo) {
      navigate("/");
      return;
    }
    await signOut();
    navigate("/login");
  }

  const displayName =
    userProfile?.name ?? user.email?.split("@")[0] ?? "프로필";

  return (
    <div className="min-h-dvh bg-surface text-foreground">
      {demo && <DemoBanner />}
      <header
        ref={megaRef}
        className="border-b border-line bg-surface relative z-30"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5">
          <Link to="/dashboard" aria-label="Meetup home" className="shrink-0">
            <BrandMark />
          </Link>

          <div className="flex items-center gap-3 sm:gap-5">
            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-1 text-sm">
              {NAV.map((entry) => {
                if (entry.kind === "leaf") {
                  return (
                    <NavLeafItem key={entry.to} to={entry.to}>
                      {entry.label}
                    </NavLeafItem>
                  );
                }
                const activeChild = isPathInGroup(location.pathname, entry);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setMegaOpen((v) => !v)}
                    aria-expanded={megaOpen}
                    aria-haspopup="menu"
                    className={`px-3 py-1.5 transition-colors ${
                      activeChild || megaOpen
                        ? "text-foreground"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    {entry.label}
                  </button>
                );
              })}
            </nav>

            {/* Search */}
            <Link
              to="/search"
              aria-label="검색"
              className="hidden sm:inline-flex items-center justify-center w-9 h-9 border border-line text-foreground-muted hover:border-foreground hover:text-foreground transition-colors"
            >
              <svg
                viewBox="0 0 20 20"
                aria-hidden
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="9" cy="9" r="6" />
                <path d="M14 14l3 3" strokeLinecap="round" />
              </svg>
            </Link>

            {/* Desktop profile chip + dropdown */}
            <div ref={profileRef} className="hidden sm:block relative">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                className={`flex items-center gap-2 border px-2 py-1.5 transition-colors ${
                  profileOpen
                    ? "border-foreground"
                    : "border-line hover:border-foreground"
                }`}
              >
                <Avatar
                  url={userProfile?.avatar_url ?? null}
                  name={displayName}
                  size="sm"
                />
                <span className="text-sm max-w-[120px] truncate">
                  {displayName}
                </span>
                <span
                  aria-hidden
                  className={`text-foreground-faint text-xs transition-transform ${
                    profileOpen ? "rotate-180" : ""
                  }`}
                >
                  ▾
                </span>
              </button>

              {profileOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+0px)] w-56 border border-foreground bg-surface z-40 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
                >
                  <ul>
                    {PROFILE_PRIMARY.map((item) => (
                      <li key={item.to} role="none">
                        <NavLink
                          to={item.to}
                          end={false}
                          onClick={() => setProfileOpen(false)}
                          className={({ isActive }) =>
                            `block px-4 py-3 text-sm transition-colors ${
                              isActive
                                ? "text-accent-teal bg-accent-teal/10"
                                : "text-foreground-muted hover:text-foreground hover:bg-surface-muted"
                            }`
                          }
                          role="menuitem"
                        >
                          {item.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                  <ul className="border-t border-line">
                    {profileSecondary.map((item) => (
                      <li key={item.to} role="none">
                        <NavLink
                          to={item.to}
                          end={false}
                          onClick={() => setProfileOpen(false)}
                          className={({ isActive }) =>
                            `block px-4 py-3 text-sm transition-colors ${
                              isActive
                                ? "text-accent-teal bg-accent-teal/10"
                                : "text-foreground-muted hover:text-foreground hover:bg-surface-muted"
                            }`
                          }
                          role="menuitem"
                        >
                          {item.label}
                        </NavLink>
                      </li>
                    ))}
                    <li role="none">
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-3 text-sm text-foreground-faint hover:text-foreground hover:bg-surface-muted"
                        role="menuitem"
                      >
                        {demo ? "나가기" : "로그아웃"}
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Desktop mega-menu panel — animated slide-down */}
        <div
          className={`hidden sm:grid absolute left-0 right-0 top-full bg-surface z-10 overflow-hidden transition-[grid-template-rows,opacity,border-bottom-width] duration-300 ease-out ${
            megaOpen
              ? "grid-rows-[1fr] opacity-100 border-b border-line"
              : "grid-rows-[0fr] opacity-0 pointer-events-none"
          }`}
          aria-hidden={!megaOpen}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="mx-auto max-w-6xl px-4 sm:px-8 py-10">
              <div className="grid grid-cols-4 gap-12">
                {NAV.filter(
                  (e): e is Extract<NavEntry, { kind: "group" }> =>
                    e.kind === "group",
                ).map((group) => (
                  <div key={group.id}>
                    <p className="label">{group.label}</p>
                    <ul className="mt-4 space-y-1">
                      {group.items.map((item) => (
                        <li key={item.to}>
                          <NavLink
                            to={item.to}
                            end={false}
                            onClick={() => setMegaOpen(false)}
                            className={({ isActive }) =>
                              `block py-1.5 text-sm transition-colors ${
                                isActive
                                  ? "text-foreground"
                                  : "text-foreground-muted hover:text-foreground"
                              }`
                            }
                          >
                            {item.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>
      <div
        className={`hidden sm:block fixed inset-0 z-20 bg-foreground/10 transition-opacity duration-300 ${
          megaOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMegaOpen(false)}
        aria-hidden
      />

      {/* Mobile "더보기" bottom sheet — slides up from bottom */}
      {menuOpen && (
        <div className="sm:hidden fixed inset-0 z-30" aria-hidden={!menuOpen}>
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="absolute bottom-0 left-0 right-0 bg-surface border-t border-line max-h-[85dvh] overflow-y-auto pb-safe-bottom">
            {/* Drag handle */}
            <div className="pt-2 pb-1 flex justify-center" aria-hidden>
              <span className="block w-10 h-1 bg-line-strong rounded-full" />
            </div>

            {/* Profile chip header */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-line">
              <Avatar
                url={userProfile?.avatar_url ?? null}
                name={displayName}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{displayName}</p>
                <p className="text-xs text-foreground-faint truncate">
                  {user.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="닫기"
                className="text-xs text-foreground-muted hover:text-foreground border border-line-strong px-3 py-1.5 hover:border-foreground"
              >
                닫기
              </button>
            </div>

            <Link
              to="/search"
              className="flex items-center gap-3 px-4 py-4 border-b border-line text-base text-foreground-muted hover:text-foreground hover:bg-surface-muted"
            >
              <svg
                viewBox="0 0 20 20"
                aria-hidden
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="9" cy="9" r="6" />
                <path d="M14 14l3 3" strokeLinecap="round" />
              </svg>
              <span>통합 검색</span>
            </Link>

            {/* 모바일에서는 마이 메뉴를 검색 바로 아래 최상단에 배치 */}
            <div className="pt-3 border-t border-line/60">
              <p className="label px-4 pb-2">마이</p>
              <ul>
                {PROFILE_PRIMARY.map((item) => (
                  <li key={item.to}>
                    <MobileLink to={item.to} label={item.label} />
                  </li>
                ))}
              </ul>
            </div>

            {NAV.map((entry) => {
              if (entry.kind === "leaf") {
                return (
                  <ul key={entry.to} className="border-t border-line/60">
                    <li>
                      <MobileLink to={entry.to} label={entry.label} />
                    </li>
                  </ul>
                );
              }
              return (
                <div key={entry.id} className="pt-3 border-t border-line/60">
                  <p className="label px-4 pb-2">{entry.label}</p>
                  <ul>
                    {entry.items.map((item) => (
                      <li key={item.to}>
                        <MobileLink to={item.to} label={item.label} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            <div className="pt-3 pb-2 border-t border-line/60">
              <p className="label px-4 pb-2">기타</p>
              <ul>
                {profileSecondary.map((item) => (
                  <li key={item.to}>
                    <MobileLink to={item.to} label={item.label} />
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-between px-4 py-4 text-base text-foreground-faint hover:text-foreground hover:bg-surface-muted"
                  >
                    <span>{demo ? "나가기" : "로그아웃"}</span>
                    <span aria-hidden className="text-foreground-faint">
                      ›
                    </span>
                  </button>
                </li>
              </ul>
            </div>
          </nav>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 sm:px-8 py-10 sm:py-14 pb-24 sm:pb-14">
        {wsLoading ? null : workspace ? <Outlet /> : <JoinFlow />}
      </main>

      {workspace && (
        <MobileBottomNav
          moreOpen={menuOpen}
          onToggleMore={() => setMenuOpen((v) => !v)}
        />
      )}
    </div>
  );
}

function NavLeafItem({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={false}
      className={({ isActive }) =>
        `px-3 py-1.5 transition-colors ${
          isActive
            ? "text-foreground"
            : "text-foreground-muted hover:text-foreground"
        }`
      }
    >
      {children}
    </NavLink>
  );
}

function MobileLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={false}
      className={({ isActive }) =>
        `flex items-center justify-between px-4 py-3.5 text-base transition-colors ${
          isActive
            ? "text-accent-teal bg-accent-teal/10"
            : "text-foreground-muted hover:text-foreground hover:bg-surface-muted"
        }`
      }
    >
      <span>{label}</span>
      <span aria-hidden className="text-foreground-faint">
        ›
      </span>
    </NavLink>
  );
}

function DemoBanner() {
  return (
    <div className="border-b border-line bg-surface-muted">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-2 flex items-center justify-between">
        <p className="text-xs text-foreground-muted">
          <span className="label mr-2">Demo</span>
          Supabase 가 아직 연결되지 않았습니다. 목업 데이터로 표시 중.
        </p>
      </div>
    </div>
  );
}
