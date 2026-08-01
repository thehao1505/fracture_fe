import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create account — fracture" };

export default function RegisterPage() {
  return (
    <Card>
      <h1 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Create your account
      </h1>
      <RegisterForm />
    </Card>
  );
}
