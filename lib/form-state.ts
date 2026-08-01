/** Shared shape for useActionState-driven forms. */
export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
}

export const INITIAL_FORM_STATE: FormState = {};
