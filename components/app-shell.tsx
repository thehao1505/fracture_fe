import Link from "next/link";
import { logoutAction } from "@/app/(auth)/actions";

/** Shared chrome for signed-in screens (/dashboard). */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4">
          <nav className="flex items-center gap-6">
            <Link
              href="/"
              className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
            >
              fracture
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              My page
            </Link>
          </nav>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
