import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { subdomainFromHost } from "@/lib/domain";
import { requireAccessToken } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Admin — fracture" };

/**
 * Reachable only via admin.${ROOT_DOMAIN} — proxy.ts rewrites that host here,
 * but this is still an ordinary routable path, so ${ROOT_DOMAIN}/admin would
 * otherwise render it directly too. 404 unless the request actually came in
 * on the admin subdomain.
 *
 * requireAccessToken only proves a session exists — the JWT has no role
 * claim yet, so this does not yet prove the caller is an
 * admin. Treat this as a routing scaffold until the backend exposes a role.
 */
export default async function AdminPage() {
  const host = (await headers()).get("host") ?? "";
  if (subdomainFromHost(host) !== "admin") notFound();

  await requireAccessToken();

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Admin — coming soon.
      </p>
    </div>
  );
}
