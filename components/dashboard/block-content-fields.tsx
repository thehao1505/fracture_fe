"use client";

import type {
  BlockContent,
  BlockType,
  HeaderContent,
  LinkContent,
  SocialsContent,
} from "@/lib/api/types";
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
    const link = content as LinkContent | undefined;
    return (
      <>
        <Field label="Title" htmlFor={`${idPrefix}-title`} hint="1–80 characters.">
          <Input
            id={`${idPrefix}-title`}
            name="title"
            defaultValue={link?.title ?? ""}
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
            defaultValue={link?.url ?? ""}
            required
            placeholder="https://example.com"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Icon (optional)" htmlFor={`${idPrefix}-icon`}>
            <Input
              id={`${idPrefix}-icon`}
              name="icon"
              defaultValue={link?.icon ?? ""}
            />
          </Field>
          <Field label="Thumbnail (optional)" htmlFor={`${idPrefix}-thumbnail`}>
            <Input
              id={`${idPrefix}-thumbnail`}
              name="thumbnail"
              defaultValue={link?.thumbnail ?? ""}
            />
          </Field>
        </div>
      </>
    );
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
