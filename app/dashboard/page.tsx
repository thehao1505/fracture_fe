import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ApiError } from "@/lib/api/client";
import { getMyProfile } from "@/lib/api/me";
import type { Profile } from "@/lib/api/types";
import { requireSessionToken } from "@/lib/session";
import { Card } from "@/components/ui";
import { CreateProfileForm } from "@/components/dashboard/create-profile-form";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { BlocksManager } from "@/components/dashboard/blocks-manager";
import { PublishToggle } from "@/components/dashboard/publish-toggle";

export const metadata: Metadata = { title: "Dashboard — fracture" };

export default async function DashboardPage() {
  const token = await requireSessionToken();

  let profile: Profile | null = null;
  try {
    profile = (await getMyProfile(token)).data;
  } catch (err) {
    if (err instanceof ApiError) {
      // §7.1 — 404 means the user has no profile yet: show onboarding.
      if (err.isNotFound) profile = null;
      else if (err.isUnauthorized) redirect("/logout");
      else throw err;
    } else {
      throw err;
    }
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Claim your page
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Pick a username to create your fracture page. You can add links and
          publish it right after.
        </p>
        <Card>
          <CreateProfileForm />
        </Card>
      </div>
    );
  }

  const blocks = profile.blocks ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            My page
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {profile.is_published ? (
              <>
                Live at{" "}
                <Link
                  href={`/${profile.username}`}
                  className="font-medium text-zinc-900 underline dark:text-zinc-100"
                >
                  /{profile.username}
                </Link>
              </>
            ) : (
              "Not published — visitors will get a 404 until you publish."
            )}
          </p>
        </div>
        <PublishToggle isPublished={profile.is_published} />
      </div>

      <section className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Profile
          </h2>
          <Card>
            <ProfileForm profile={profile} />
          </Card>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Blocks ({blocks.length}/100)
          </h2>
          <BlocksManager blocks={blocks} />
        </div>
      </section>
    </div>
  );
}
