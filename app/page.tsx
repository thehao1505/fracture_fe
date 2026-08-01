import Link from "next/link";
import { getSessionToken } from "@/lib/session";

export default async function Home() {
  const isSignedIn = Boolean(await getSessionToken());

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <main className="flex max-w-xl flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          fracture
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          One page for all your links. Claim a username, add your links, and
          share a single URL anywhere.
        </p>
        <div className="flex gap-3">
          {isSignedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Go to my page
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="inline-flex h-11 items-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Get started
              </Link>
              <Link
                href="/login"
                className="inline-flex h-11 items-center rounded-full border border-zinc-300 px-6 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
