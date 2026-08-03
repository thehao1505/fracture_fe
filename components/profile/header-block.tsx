/**
 * A `header` block. It opens a section rather than decorating one line, so it
 * is rendered as the heading of the `<section>` that wraps the blocks that
 * follow it (see `profile-blocks.tsx`) — the divider sits under the label
 * instead of slicing through the middle of it.
 */
export function HeaderBlock({
  id,
  text,
  index,
}: {
  id: string;
  text: string;
  index: number;
}) {
  return (
    <div
      className="pf-reveal flex flex-col gap-2"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <h2
        id={id}
        className="text-xs font-semibold uppercase tracking-[0.14em]"
        style={{ color: "var(--pf-muted)" }}
      >
        {text}
      </h2>
      <span
        aria-hidden
        className="h-px w-full"
        style={{ backgroundColor: "var(--pf-hairline)" }}
      />
    </div>
  );
}
