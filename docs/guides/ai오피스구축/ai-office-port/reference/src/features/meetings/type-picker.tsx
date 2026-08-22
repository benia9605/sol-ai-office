import { useEffect, useRef, useState } from "react";
import type { MeetingType } from "@/lib/types/database";

type Props = {
  types: MeetingType[];
  value: string | null;
  onChange: (next: string | null) => void;
  placeholder?: string;
};

export function TypePicker({
  types,
  value,
  onChange,
  placeholder = "종류 선택",
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = types.find((t) => t.id === value) ?? null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`w-full flex items-center gap-2 border px-3 py-2.5 bg-surface text-sm text-left transition-colors ${
          open
            ? "border-foreground"
            : "border-line-strong hover:border-foreground"
        }`}
      >
        {selected ? (
          <>
            <ColorDot color={selected.color} />
            <span>{selected.name}</span>
          </>
        ) : (
          <span className="text-foreground-faint">{placeholder}</span>
        )}
        <span
          aria-hidden
          className={`ml-auto text-foreground-faint text-xs transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 border border-line bg-surface z-30 max-h-72 overflow-y-auto"
        >
          <li>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-surface-muted ${
                value === null ? "bg-surface-muted" : ""
              }`}
            >
              <span
                aria-hidden
                className="size-2.5 rounded-full border border-line shrink-0"
              />
              <span className="text-foreground-muted">종류 없음</span>
            </button>
          </li>
          {types.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(t.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-surface-muted ${
                  value === t.id ? "bg-surface-muted" : ""
                }`}
              >
                <ColorDot color={t.color} />
                <span>{t.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ColorDot({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="rounded-full shrink-0"
      style={{ backgroundColor: color, width: size, height: size }}
    />
  );
}
