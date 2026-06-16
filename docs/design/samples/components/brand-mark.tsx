type Props = {
  className?: string;
};

/**
 * Brand wordmark with a single teal dot — the one persistent color
 * accent across the app. Use this anywhere the "Meetup" word appears
 * as a logo / nav identity.
 */
export function BrandMark({ className = "" }: Props) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden
        className="block size-1.5 rounded-full bg-accent-teal"
      />
      <span className="label">Meetup</span>
    </span>
  );
}
