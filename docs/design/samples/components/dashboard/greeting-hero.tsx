import { formatFullDate } from "@/lib/format";

type Props = {
  name: string | null;
  workspaceName?: string | null;
};

export function GreetingHero({ name, workspaceName }: Props) {
  const today = formatFullDate(new Date());
  const display = name ?? "친구";

  return (
    <section>
      <p className="label">{today}</p>
      <h1 className="mt-5 text-4xl font-light leading-[1.25] sm:text-5xl">
        <span className="font-semibold text-accent-teal">{display}</span>님,
        <br />
        좋은 일만 있길.
      </h1>
      {workspaceName && (
        <p className="mt-6 max-w-lg text-sm leading-[1.85] text-foreground-muted">
          지금 보고 있는 모임은{" "}
          <span className="text-foreground">{workspaceName}</span> 입니다.
        </p>
      )}
    </section>
  );
}
