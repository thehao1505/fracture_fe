import Link from "next/link";
import { ArrowUpRight, AtSign } from "lucide-react";
import { GradientMesh } from "@/components/gradient-mesh";

/**
 * §7.2 — a 404 here means the username is unknown *or* unpublished, so the
 * copy can't claim the handle is free. It can still point somewhere useful.
 */
export default function ProfileNotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <GradientMesh />

      <div className="pf-reveal flex flex-col items-center gap-5">
        <div className="relative">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 scale-125 rounded-full bg-gradient-to-br from-brand-from via-brand-via to-brand-to opacity-30 blur-2xl"
          />
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/60 bg-white/60 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <AtSign className="h-8 w-8 text-brand-via" aria-hidden />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            This page isn&apos;t here
          </h1>
          <p className="max-w-xs text-pretty text-sm text-zinc-500 dark:text-zinc-400">
            The link may be wrong, or its owner hasn&apos;t published the page
            yet.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/register"
            className="group inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-brand-from via-brand-via to-brand-to px-4 text-sm font-medium text-white shadow-lg shadow-brand-via/25 transition-shadow hover:shadow-xl hover:shadow-brand-via/35"
          >
            Make your own page
            <ArrowUpRight
              className="h-4 w-4 opacity-70 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
