"use client";

import { TriangleAlert } from "lucide-react";
import { GradientMesh } from "@/components/gradient-mesh";
import { Button, Card } from "@/components/ui";

/**
 * Catches unexpected failures (API 500s, network errors when the Fracture API
 * is unreachable). Uses the Next 16 `unstable_retry` prop (preferred over the
 * deprecated-in-docs `reset`).
 */
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const isApiDown = error.message.includes("could not reach the Fracture API");

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <GradientMesh />
      <Card>
        <div className="flex flex-col items-center gap-3">
          <TriangleAlert className="h-8 w-8 text-amber-500" aria-hidden />
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Something went wrong
          </h1>
          <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            {isApiDown
              ? "The Fracture API is unreachable. Make sure the backend is running, then try again."
              : "An unexpected error occurred. Please try again."}
          </p>
          <Button onClick={() => unstable_retry()} className="mt-2">
            Try again
          </Button>
        </div>
      </Card>
    </div>
  );
}
