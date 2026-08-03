"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { motion } from "framer-motion";
import { CircleAlert, CircleCheck, Inbox, Info, type LucideIcon } from "lucide-react";

/** Shared glass-surface classes — light glass on light bg, subtle glass on dark bg. */
const GLASS =
  "border border-white/60 bg-white/60 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/50";

export function Alert({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: ReactNode;
}) {
  const styles = {
    error:
      "border-red-200/70 bg-red-50/80 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
    success:
      "border-emerald-200/70 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    info: `${GLASS} text-zinc-700 dark:text-zinc-300`,
  }[tone];
  const Icon = { error: CircleAlert, success: CircleCheck, info: Info }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm backdrop-blur-xl ${styles}`}
      role="alert"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </motion.div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
      >
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

const FIELD_BASE =
  "w-full min-w-0 rounded-xl border border-zinc-200/80 bg-white/70 px-3 text-sm text-zinc-900 outline-none backdrop-blur-sm transition placeholder:text-zinc-400 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-brand-via/50 dark:border-white/10 dark:bg-zinc-900/50 dark:text-zinc-100 dark:focus:bg-zinc-900 dark:focus:ring-brand-via/40";

export function Input(props: ComponentPropsWithoutRef<"input">) {
  return (
    <input
      {...props}
      className={`h-10 ${FIELD_BASE} ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: ComponentPropsWithoutRef<"textarea">) {
  return (
    <textarea
      {...props}
      className={`py-2 ${FIELD_BASE} ${props.className ?? ""}`}
    />
  );
}

export function Select(props: ComponentPropsWithoutRef<"select">) {
  return (
    <select
      {...props}
      className={`h-10 ${FIELD_BASE} ${props.className ?? ""}`}
    />
  );
}

const buttonVariants = {
  primary:
    "bg-gradient-to-r from-brand-from via-brand-via to-brand-to text-white shadow-lg shadow-brand-via/25 hover:shadow-xl hover:shadow-brand-via/35 disabled:opacity-50 disabled:shadow-none",
  secondary: `${GLASS} text-zinc-800 hover:bg-white/80 disabled:text-zinc-400 dark:text-zinc-200 dark:hover:bg-zinc-900/80`,
  danger:
    "border border-red-200/70 bg-white/70 text-red-600 backdrop-blur-xl hover:bg-red-50/80 disabled:text-red-300 dark:border-red-900/50 dark:bg-zinc-900/50 dark:text-red-400 dark:hover:bg-red-950/40",
} as const;

type ButtonProps = Omit<
  ComponentPropsWithoutRef<"button">,
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
> & {
  variant?: keyof typeof buttonVariants;
};

export function Button({ variant = "primary", ...props }: ButtonProps) {
  return (
    <motion.button
      whileHover={props.disabled ? undefined : { scale: 1.02 }}
      whileTap={props.disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.15 }}
      {...props}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed ${buttonVariants[variant]} ${props.className ?? ""}`}
    />
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div
      className={`rounded-2xl ${GLASS} p-6 shadow-xl shadow-brand-via/5 dark:shadow-none`}
    >
      {children}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  icon: Icon,
  children,
}: {
  tone?: "neutral" | "warning" | "brand";
  icon?: LucideIcon;
  children: ReactNode;
}) {
  const styles = {
    neutral:
      "bg-zinc-100/80 text-zinc-600 dark:bg-white/10 dark:text-zinc-300",
    warning:
      "bg-amber-100/80 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
    brand:
      "bg-gradient-to-r from-brand-from/15 to-brand-to/15 text-brand-via dark:text-fuchsia-300",
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden />}
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-2xl border border-dashed border-zinc-300/80 px-6 py-12 text-center dark:border-white/15`}
    >
      <Inbox className="h-6 w-6 text-zinc-400 dark:text-zinc-500" aria-hidden />
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{title}</p>
      {children && (
        <div className="text-sm text-zinc-500 dark:text-zinc-400">{children}</div>
      )}
    </div>
  );
}
