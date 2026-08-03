"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { createProfileAction } from "@/app/dashboard/actions";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";

export function CreateProfileForm() {
  const [state, formAction, pending] = useActionState(
    createProfileAction,
    INITIAL_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field
        label="Username"
        htmlFor="username"
        error={state.fieldErrors?.username}
        hint="3–30 characters: lowercase letters, numbers, _ and . — this becomes your public URL."
      >
        <Input
          id="username"
          name="username"
          required
          minLength={3}
          maxLength={30}
          pattern="[a-zA-Z0-9_.]+"
          placeholder="jane"
          autoComplete="off"
        />
      </Field>
      <Field label="Display name (optional)" htmlFor="display_name">
        <Input id="display_name" name="display_name" placeholder="Jane Doe" />
      </Field>
      <Field label="Bio (optional)" htmlFor="bio">
        <Textarea id="bio" name="bio" rows={3} placeholder="hi there" />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? "Creating…" : "Create my page"}
      </Button>
    </form>
  );
}
