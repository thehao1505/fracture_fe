"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { updateProfileAction } from "@/app/dashboard/actions";
import type { BackgroundType, Profile } from "@/lib/api/types";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { safeImageUrl } from "@/lib/validation";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

const HEX_PATTERN = "#[0-9a-fA-F]{6}";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    INITIAL_FORM_STATE,
  );
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  // Live API returns null until appearance is first set (contract says {})
  const appearance = profile.appearance ?? {};
  const [backgroundType, setBackgroundType] = useState(
    appearance.background?.type ?? "",
  );

  // §8.3 — avatar_url is unvalidated server-side; only preview http/https.
  const avatarPreview = safeImageUrl(avatarUrl);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      {/* §7.9 — PUT is full-replace: preserve the current publish state here;
          the Publish button is the only thing that changes it. */}
      {profile.is_published && (
        <input type="hidden" name="is_published" value="on" />
      )}

      <Field
        label="Username"
        htmlFor="username"
        error={state.fieldErrors?.username}
        hint="Changing this changes your public URL."
      >
        <Input
          id="username"
          name="username"
          defaultValue={profile.username}
          required
          minLength={3}
          maxLength={30}
          pattern="[a-zA-Z0-9_.]+"
        />
      </Field>

      <Field label="Display name" htmlFor="display_name">
        <Input
          id="display_name"
          name="display_name"
          defaultValue={profile.display_name}
          placeholder="Jane Doe"
        />
      </Field>

      <Field label="Bio" htmlFor="bio">
        <Textarea id="bio" name="bio" rows={3} defaultValue={profile.bio} />
      </Field>

      <Field
        label="Avatar URL"
        htmlFor="avatar_url"
        hint="Must be an http(s) image URL."
      >
        <div className="flex items-center gap-3">
          {avatarPreview && (
            /* eslint-disable-next-line @next/next/no-img-element -- arbitrary
               user-supplied hosts; next/image would need remotePatterns */
            <img
              src={avatarPreview}
              alt="Avatar preview"
              className="h-10 w-10 rounded-full border-2 border-white object-cover shadow-sm ring-1 ring-zinc-200 dark:border-zinc-900 dark:ring-white/10"
            />
          )}
          <Input
            id="avatar_url"
            name="avatar_url"
            type="url"
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="https://…"
            className="flex-1"
          />
        </div>
      </Field>

      <fieldset className="flex flex-col gap-4 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-white/10 dark:bg-white/5">
        <legend className="px-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Appearance
        </legend>

        <Field label="Theme" htmlFor="theme">
          <Select id="theme" name="theme" defaultValue={appearance.theme ?? ""}>
            <option value="">Default</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Background" htmlFor="background_type">
            <Select
              id="background_type"
              name="background_type"
              value={backgroundType}
              onChange={(event) =>
                setBackgroundType(event.target.value as BackgroundType)
              }
            >
              <option value="">Default</option>
              <option value="color">Color</option>
              <option value="gradient">Gradient</option>
              <option value="image">Image</option>
            </Select>
          </Field>
          <Field
            label={backgroundType === "color" ? "Hex color" : "Value"}
            htmlFor="background_value"
          >
            <Input
              id="background_value"
              name="background_value"
              defaultValue={appearance.background?.value ?? ""}
              placeholder={backgroundType === "color" ? "#1a2b3c" : "CSS value or URL"}
              pattern={backgroundType === "color" ? HEX_PATTERN : undefined}
              disabled={backgroundType === ""}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Button style" htmlFor="button_style">
            <Select
              id="button_style"
              name="button_style"
              defaultValue={appearance.button?.style ?? ""}
            >
              <option value="">Default</option>
              <option value="rounded">Rounded</option>
              <option value="sharp">Sharp</option>
              <option value="pill">Pill</option>
            </Select>
          </Field>
          <Field label="Button color" htmlFor="button_color">
            <Input
              id="button_color"
              name="button_color"
              defaultValue={appearance.button?.color ?? ""}
              placeholder="#1a2b3c"
              pattern={HEX_PATTERN}
            />
          </Field>
        </div>

        <Field label="Font" htmlFor="font">
          <Input
            id="font"
            name="font"
            defaultValue={appearance.font ?? ""}
            placeholder="Inter"
          />
        </Field>
      </fieldset>

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
