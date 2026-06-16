type Size = "sm" | "md" | "lg" | "xl";

const dims: Record<Size, string> = {
  sm: "size-8",
  md: "size-10",
  lg: "size-14",
  xl: "size-20",
};

type Props = {
  url: string | null;
  name: string;
  size?: Size;
};

export function Avatar({ url, name, size = "md" }: Props) {
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  const cls = `${dims[size]} shrink-0 rounded-full overflow-hidden border border-line bg-surface-muted`;
  if (url) {
    return (
      <div className={cls}>
        <img src={url} alt="" className="size-full object-cover" />
      </div>
    );
  }
  return (
    <div className={`${cls} flex items-center justify-center`}>
      <span
        className={
          size === "xl"
            ? "text-2xl text-foreground-muted font-light"
            : "text-sm text-foreground-muted"
        }
      >
        {initial}
      </span>
    </div>
  );
}
