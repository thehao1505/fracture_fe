"use client";

import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import type {
  BlockContent,
  BlockType,
  HeaderContent,
  LinkContent,
  SocialsContent,
} from "@/lib/api/types";
import { isHttpUrl } from "@/lib/validation";
import { Field, Input } from "@/components/ui";
import { SocialItemsEditor } from "./social-items-editor";

/**
 * §5 content schemas, mirrored as form fields. Field names line up with what
 * `parseBlockContent` in app/dashboard/actions.ts reads.
 */
export function BlockContentFields({
  type,
  idPrefix,
  content,
}: {
  type: BlockType;
  idPrefix: string;
  content?: BlockContent;
}) {
  if (type === "link") {
    return <LinkFields idPrefix={idPrefix} content={content as LinkContent | undefined} />;
  }

  if (type === "header") {
    const header = content as HeaderContent | undefined;
    return (
      <Field label="Text" htmlFor={`${idPrefix}-text`} hint="1–80 characters.">
        <Input
          id={`${idPrefix}-text`}
          name="text"
          defaultValue={header?.text ?? ""}
          required
          minLength={1}
          maxLength={80}
          placeholder="My links"
        />
      </Field>
    );
  }

  const socials = content as SocialsContent | undefined;
  return <SocialItemsEditor initial={socials?.items ?? []} />;
}

/**
 * The thumbnail auto-fills from the URL's og:image (app/api/link-preview) on
 * blur, but stays a plain text input — pasting over it (or clicking the wand
 * to re-fetch after changing the URL) always wins.
 */
function LinkFields({
  idPrefix,
  content,
}: {
  idPrefix: string;
  content?: LinkContent;
}) {
  const [url, setUrl] = useState(content?.url ?? "");
  const [thumbnail, setThumbnail] = useState(content?.thumbnail ?? "");
  const [status, setStatus] = useState<"idle" | "fetching" | "empty">("idle");

  async function fetchThumbnail(candidateUrl: string) {
    if (!isHttpUrl(candidateUrl)) return;
    setStatus("fetching");
    try {
      const response = await fetch(`/api/link-preview?url=${encodeURIComponent(candidateUrl)}`);
      const data = (await response.json()) as { thumbnail?: string | null };
      if (data.thumbnail) {
        setThumbnail(data.thumbnail);
        setStatus("idle");
      } else {
        setStatus("empty");
      }
    } catch {
      setStatus("empty");
    }
  }

  const hint =
    status === "fetching"
      ? "Fetching preview image…"
      : status === "empty"
        ? "Couldn't find a preview image — paste one instead."
        : "Auto-filled from the page's preview image; paste your own to override.";

  return (
    <>
      <Field label="Title" htmlFor={`${idPrefix}-title`} hint="1–80 characters.">
        <Input
          id={`${idPrefix}-title`}
          name="title"
          defaultValue={content?.title ?? ""}
          required
          minLength={1}
          maxLength={80}
          placeholder="My site"
        />
      </Field>
      <Field
        label="URL"
        htmlFor={`${idPrefix}-url`}
        hint="Must start with http:// or https://"
      >
        <Input
          id={`${idPrefix}-url`}
          name="url"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onBlur={() => {
            // Never clobber a thumbnail the user already pasted or fetched.
            if (!thumbnail.trim()) void fetchThumbnail(url);
          }}
          required
          placeholder="https://example.com"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Icon (optional)" htmlFor={`${idPrefix}-icon`}>
          <Input
            id={`${idPrefix}-icon`}
            name="icon"
            defaultValue={content?.icon ?? ""}
          />
        </Field>
        <Field label="Thumbnail (optional)" htmlFor={`${idPrefix}-thumbnail`} hint={hint}>
          <div className="relative">
            <Input
              id={`${idPrefix}-thumbnail`}
              name="thumbnail"
              value={thumbnail}
              onChange={(event) => {
                setThumbnail(event.target.value);
                setStatus("idle");
              }}
              placeholder="https://…"
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => fetchThumbnail(url)}
              disabled={status === "fetching" || !isHttpUrl(url)}
              aria-label="Fetch preview image from URL"
              title="Fetch preview image from URL"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100/80 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-white/10"
            >
              {status === "fetching" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Wand2 className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
        </Field>
      </div>
    </>
  );
}
