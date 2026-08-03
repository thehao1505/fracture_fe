import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import { GradientMesh } from "@/components/gradient-mesh";
import { DashboardNav } from "@/components/dashboard-nav";

/** Shared chrome for signed-in screens (/dashboard). */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <GradientMesh />
      <header className="sticky top-0 z-10 border-b border-white/60 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-black/50">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4">
          <nav className="flex items-center gap-6">
            <Link
              href="/"
              className="bg-gradient-to-r from-brand-from via-brand-via to-brand-to bg-clip-text text-lg font-bold tracking-tight text-transparent"
            >
              fracture
            </Link>
            <DashboardNav />
          </nav>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="relative mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
