"use client";

import { useActionState, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Loader2,
  MousePointerClick,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  addBlockAction,
  deleteBlockAction,
  reorderBlocksAction,
  toggleBlockVisibilityAction,
  updateBlockAction,
} from "@/app/dashboard/actions";
import type { Block, BlockType, LinkContent, SocialsContent, HeaderContent } from "@/lib/api/types";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Alert, Badge, Button, Card, EmptyState, Select } from "@/components/ui";
import { BlockContentFields } from "./block-content-fields";

const MAX_BLOCKS = 100; // §7.5

const TYPE_LABELS: Record<BlockType, string> = {
  link: "Link",
  socials: "Socials",
  header: "Header",
};

function blockSummary(block: Block): string {
  if (block.type === "link") {
    const content = block.content as LinkContent;
    return `${content.title} → ${content.url}`;
  }
  if (block.type === "socials") {
    const content = block.content as SocialsContent;
    return content.items.map((item) => item.platform).join(", ");
  }
  return (block.content as HeaderContent).text;
}

export function BlocksManager({ blocks }: { blocks: Block[] }) {
  const [pending, startTransition] = useTransition();
  const [listError, setListError] = useState<string | undefined>();

  const run = (action: () => Promise<{ error?: string }>) => {
    startTransition(async () => {
      const result = await action();
      setListError(result.error);
    });
  };

  // §7.7 — reorder sends the exact, complete set of current block ids.
  const move = (index: number, delta: -1 | 1) => {
    const order = blocks.map((block) => block.id);
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    run(() => reorderBlocksAction(order));
  };

  return (
    <div className="flex flex-col gap-4">
      {listError && <Alert tone="error">{listError}</Alert>}

      {blocks.length === 0 ? (
        <EmptyState title="No blocks yet">
          Add your first link, header, or socials row below.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          <AnimatePresence initial={false} mode="popLayout">
            {blocks.map((block, index) => (
              <BlockRow
                key={block.id}
                block={block}
                pending={pending}
                onMoveUp={index > 0 ? () => move(index, -1) : undefined}
                onMoveDown={
                  index < blocks.length - 1 ? () => move(index, 1) : undefined
                }
                onToggle={() => run(() => toggleBlockVisibilityAction(block.id))}
                onDelete={() => {
                  if (window.confirm("Delete this block? This cannot be undone.")) {
                    run(() => deleteBlockAction(block.id));
                  }
                }}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}

      <AddBlockForm disabled={blocks.length >= MAX_BLOCKS} />
    </div>
  );
}

function BlockRow({
  block,
  pending,
  onMoveUp,
  onMoveDown,
  onToggle,
  onDelete,
}: {
  block: Block;
  pending: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl border border-white/60 bg-white/60 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{TYPE_LABELS[block.type]}</Badge>
            {!block.is_active && (
              <Badge tone="warning" icon={EyeOff}>
                Hidden
              </Badge>
            )}
            {block.type === "link" && (
              <span className="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500">
                <MousePointerClick className="h-3 w-3" aria-hidden />
                {block.click_count} click{block.click_count === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
            {blockSummary(block)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton label="Move up" onClick={onMoveUp} disabled={pending || !onMoveUp}>
            <ArrowUp className="h-4 w-4" aria-hidden />
          </IconButton>
          <IconButton
            label="Move down"
            onClick={onMoveDown}
            disabled={pending || !onMoveDown}
          >
            <ArrowDown className="h-4 w-4" aria-hidden />
          </IconButton>
          <IconButton
            label={block.is_active ? "Hide block" : "Show block"}
            onClick={onToggle}
            disabled={pending}
          >
            {block.is_active ? (
              <Eye className="h-4 w-4" aria-hidden />
            ) : (
              <EyeOff className="h-4 w-4" aria-hidden />
            )}
          </IconButton>
          <IconButton label={editing ? "Close editor" : "Edit block"} onClick={() => setEditing((v) => !v)}>
            {editing ? (
              <X className="h-4 w-4" aria-hidden />
            ) : (
              <Pencil className="h-4 w-4" aria-hidden />
            )}
          </IconButton>
          <IconButton label="Delete block" onClick={onDelete} disabled={pending} danger>
            <Trash2 className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {editing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 border-t border-zinc-200/60 pt-4 dark:border-white/10">
              <EditBlockForm block={block} onSaved={() => setEditing(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          : "text-zinc-600 hover:bg-zinc-100/80 dark:text-zinc-300 dark:hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function EditBlockForm({ block, onSaved }: { block: Block; onSaved: () => void }) {
  const [state, formAction, pending] = useActionState(
    async (prev: typeof INITIAL_FORM_STATE, formData: FormData) => {
      const result = await updateBlockAction(prev, formData);
      if (result.success) onSaved();
      return result;
    },
    INITIAL_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="id" value={block.id} />
      <input type="hidden" name="type" value={block.type} />
      <BlockContentFields
        type={block.type}
        idPrefix={`edit-${block.id}`}
        content={block.content}
      />
      <Button type="submit" disabled={pending} className="self-start">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? "Saving…" : "Save block"}
      </Button>
    </form>
  );
}

function AddBlockForm({ disabled }: { disabled: boolean }) {
  const [type, setType] = useState<BlockType>("link");
  const [state, formAction, pending] = useActionState(
    addBlockAction,
    INITIAL_FORM_STATE,
  );

  if (disabled) {
    // §7.5 — server rejects block #101; don't offer the form at the limit.
    return <Alert tone="info">Block limit reached (100 per profile).</Alert>;
  }

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Add a block
        </h3>
        {state.error && <Alert tone="error">{state.error}</Alert>}
        {state.success && <Alert tone="success">{state.success}</Alert>}
        <input type="hidden" name="type" value={type} />
        <Select
          aria-label="Block type"
          value={type}
          onChange={(event) => setType(event.target.value as BlockType)}
          className="w-40"
        >
          <option value="link">Link</option>
          <option value="header">Header</option>
          <option value="socials">Socials</option>
        </Select>
        {/* Remount fields when the type changes so defaults reset */}
        <BlockContentFields key={type} type={type} idPrefix="add" />
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" aria-hidden />
          )}
          {pending ? "Adding…" : "Add block"}
        </Button>
      </form>
    </Card>
  );
}
