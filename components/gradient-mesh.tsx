/**
 * Decorative blurred gradient blobs used behind marketing/auth/dashboard
 * chrome. Purely visual — aria-hidden and non-interactive so it never
 * intercepts clicks or gets announced to screen readers.
 *
 * `scheme` pins the palette instead of following the OS preference. Public
 * profile pages use it when their owner picked light or dark explicitly; when
 * they didn't, "auto" keeps the visitor's own preference (matching the
 * `.pf-theme-auto` tokens the page renders with).
 *
 * Class names are spelled out per scheme rather than composed — Tailwind only
 * sees literals in the source.
 */

const BACKDROP = {
  auto: "bg-zinc-50 dark:bg-black",
  light: "bg-zinc-50",
  dark: "bg-black",
} as const;

const BLOBS = {
  auto: [
    "bg-brand-from/30 dark:bg-brand-from/20",
    "bg-brand-to/25 dark:bg-brand-to/15",
    "bg-brand-via/25 dark:bg-brand-via/15",
  ],
  light: ["bg-brand-from/30", "bg-brand-to/25", "bg-brand-via/25"],
  dark: ["bg-brand-from/20", "bg-brand-to/15", "bg-brand-via/15"],
} as const;

export function GradientMesh({
  scheme = "auto",
}: {
  scheme?: "auto" | "light" | "dark";
}) {
  const [first, second, third] = BLOBS[scheme];

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${BACKDROP[scheme]}`}
    >
      <div
        className={`animate-float absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full blur-3xl ${first}`}
      />
      <div
        className={`animate-float absolute -right-24 top-1/4 h-[24rem] w-[24rem] rounded-full blur-3xl ${second}`}
        style={{ animationDelay: "-3s" }}
      />
      <div
        className={`animate-float absolute bottom-[-10rem] left-1/3 h-[26rem] w-[26rem] rounded-full blur-3xl ${third}`}
        style={{ animationDelay: "-6s" }}
      />
    </div>
  );
}
