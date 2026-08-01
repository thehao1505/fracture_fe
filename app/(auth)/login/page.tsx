import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in — fracture" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <Card>
      <h1 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Sign in
      </h1>
      <LoginForm next={next} />
    </Card>
  );
}
