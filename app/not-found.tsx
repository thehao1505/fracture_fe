import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { GradientMesh } from "@/components/gradient-mesh";
import { Card } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <GradientMesh />
      <Card>
        <div className="flex flex-col items-center gap-3">
          <FileQuestion className="h-8 w-8 text-brand-via" aria-hidden />
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Page not found
          </h1>
          <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            The page you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link
            href="/"
            className="mt-2 text-sm font-medium text-brand-via underline underline-offset-2 dark:text-fuchsia-300"
          >
            Go home
          </Link>
        </div>
      </Card>
    </div>
  );
}
