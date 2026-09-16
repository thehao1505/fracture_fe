import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Card } from "@/components/ui";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in — fracture" };

/**
 * `reason` is set by Proxy's forced-refresh path (refresh guideline §4):
 *   expired — /auth/refresh answered 401/400, or a refreshed token still 401'd.
 *             Session is gone, cookies already cleared: sign in again.
 *   network — the API was unreachable or 5xx. The tokens are deliberately
 *             untouched, so retrying the original URL is enough (§0.4).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;
  const retryPath = next?.startsWith("/") && !next.startsWith("//") ? next : null;

  return (
    <Card>
      <h1 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Sign in
      </h1>

      {reason === "expired" && (
        <div className="mb-4">
          <Alert tone="info">Your session expired. Please sign in again.</Alert>
        </div>
      )}

      {reason === "network" && (
        <div className="mb-4">
          <Alert tone="error">
            Could not reach the server, so we couldn&apos;t renew your session.
            You are still signed in —{" "}
            <Link href={retryPath ?? "/dashboard"} className="underline">
              try again
            </Link>
            .
          </Alert>
        </div>
      )}

      <LoginForm next={next} />
    </Card>
  );
}
