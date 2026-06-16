import { useEffect, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  /**
   * If false, ESC + backdrop click are blocked. Use for required flow
   * steps where accidental dismissal would lose data (e.g. signup terms).
   */
  closable?: boolean;
  title?: ReactNode;
  /** Helper text under the title. */
  subtitle?: ReactNode;
  children: ReactNode;
  /** Optional footer area separated by a hairline. */
  footer?: ReactNode;
  /** Tailwind max-width override; default is max-w-md. */
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export function Modal({
  open,
  onClose,
  closable = true,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: Props) {
  // Body scroll lock + ESC handling
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (closable) {
        onClose();
      } else {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("keydown", onKey, true);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, closable, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4 py-6 pt-safe-top pb-safe-bottom"
      onClick={closable ? onClose : undefined}
      role="presentation"
    >
      <div
        className={`relative w-full ${sizes[size]} max-h-[calc(100dvh-3rem)] overflow-auto bg-surface border border-line`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {(title || closable) && (
          <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div className="min-w-0">
              {title && <h2 className="text-base">{title}</h2>}
              {subtitle && (
                <p className="mt-1 text-xs text-foreground-faint">{subtitle}</p>
              )}
            </div>
            {closable && (
              <button
                onClick={onClose}
                aria-label="닫기"
                className="text-foreground-faint hover:text-foreground text-2xl leading-none px-1 -mr-1 -mt-1"
              >
                ×
              </button>
            )}
          </header>
        )}
        <div className="px-6 py-6">{children}</div>
        {footer && (
          <footer className="border-t border-line px-6 py-4">{footer}</footer>
        )}
      </div>
    </div>
  );
}
