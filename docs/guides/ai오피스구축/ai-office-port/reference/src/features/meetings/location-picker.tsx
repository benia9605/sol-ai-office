import { useEffect, useState } from "react";
import { inputClass } from "@/features/auth/_shared";

const PRESETS = ["홍대 비움", "줌"] as const;

type Props = {
  value: string;
  onChange: (next: string) => void;
};

export function LocationPicker({ value, onChange }: Props) {
  const initialIsPreset = (PRESETS as readonly string[]).includes(value);
  const [mode, setMode] = useState<"preset" | "custom">(() => {
    if (!value) return "preset";
    return initialIsPreset ? "preset" : "custom";
  });
  const [custom, setCustom] = useState(initialIsPreset ? "" : value);

  // Re-sync if outer value changes (e.g. edit form opens a different meeting)
  useEffect(() => {
    const isPreset = (PRESETS as readonly string[]).includes(value);
    setMode(value && !isPreset ? "custom" : "preset");
    setCustom(value && !isPreset ? value : "");
  }, [value]);

  function pickPreset(p: string) {
    setMode("preset");
    setCustom("");
    onChange(p);
  }

  function pickCustom() {
    setMode("custom");
    onChange(custom);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const active = mode === "preset" && value === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => pickPreset(p)}
              className={`border px-3 py-1.5 text-xs transition-colors ${
                active
                  ? "border-foreground bg-foreground text-accent-foreground"
                  : "border-line-strong text-foreground hover:border-foreground"
              }`}
            >
              {p}
            </button>
          );
        })}
        <button
          type="button"
          onClick={pickCustom}
          className={`border px-3 py-1.5 text-xs transition-colors ${
            mode === "custom"
              ? "border-foreground bg-foreground text-accent-foreground"
              : "border-line-strong text-foreground hover:border-foreground"
          }`}
        >
          기타
        </button>
      </div>
      {mode === "custom" && (
        <input
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="장소를 직접 입력"
          className={inputClass}
          autoFocus
        />
      )}
    </div>
  );
}
