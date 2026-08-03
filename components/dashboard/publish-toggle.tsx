"use client";

import { useState, useTransition } from "react";
import { Globe, Loader2 } from "lucide-react";
import { togglePublishAction } from "@/app/dashboard/actions";
import { Button } from "@/components/ui";

export function PublishToggle({ isPublished }: { isPublished: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      <Button
        variant={isPublished ? "secondary" : "primary"}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await togglePublishAction();
            setError(result.error);
          })
        }
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Globe className="h-4 w-4" aria-hidden />
        )}
        {pending ? "Saving…" : isPublished ? "Unpublish" : "Publish"}
      </Button>
    </div>
  );
}
