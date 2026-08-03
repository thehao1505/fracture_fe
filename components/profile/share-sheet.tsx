"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy, Share2, X } from "lucide-react";

/**
 * Share affordance for a public profile: native share where the browser has
 * it, clipboard everywhere else, plus a scannable QR.
 *
 * The QR itself is rendered on the server and passed in as `children`, so the
 * encoder never reaches the browser — this component is the only JavaScript
 * the public page ships.
 */
export function ShareSheet({
  url,
  title,
  children,
}: {
  url: string;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Read on open rather than during render: `navigator.share` isn't available
  // on the server, and branching on it while rendering desyncs hydration.
  const [canShare, setCanShare] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  function openSheet() {
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard blocked (insecure origin, denied permission) — the URL is
      // on screen and selectable, so there's nothing useful to report.
    }
  }

  async function share() {
    try {
      await navigator.share({ title, url });
    } catch {
      // Includes the user simply dismissing the share sheet.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-label="Share this page"
        className="pf-social flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Share2 className="h-[18px] w-[18px]" aria-hidden strokeWidth={1.75} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Share this page"
            className="pf-reveal w-full max-w-xs rounded-3xl border border-white/60 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Share
              </p>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-m-1 rounded-full p-1 text-zinc-400 transition-colors hover:text-zinc-900 dark:hover:text-zinc-50"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="mt-4 flex justify-center">{children}</div>

            <p className="mt-4 truncate text-center text-xs text-zinc-500 dark:text-zinc-400">
              {url.replace(/^https?:\/\//, "")}
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={copy}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-white"
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
                {copied ? "Copied" : "Copy link"}
              </button>
              {canShare && (
                <button
                  type="button"
                  onClick={share}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
                >
                  <Share2 className="h-4 w-4" aria-hidden />
                  Share via…
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
