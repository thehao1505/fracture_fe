"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addBlockAction,
  deleteBlockAction,
  reorderBlocksAction,
  toggleBlockVisibilityAction,
  updateBlockAction,
} from "@/app/dashboard/actions";
import type { Block, BlockType, LinkContent, SocialsContent, HeaderContent } from "@/lib/api/types";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Alert, Button, Card, EmptyState, Select } from "@/components/ui";
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
    <li className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {TYPE_LABELS[block.type]}
            </span>
            {!block.is_active && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                Hidden
              </span>
            )}
            {block.type === "link" && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
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
            ↑
          </IconButton>
          <IconButton
            label="Move down"
            onClick={onMoveDown}
            disabled={pending || !onMoveDown}
          >
            ↓
          </IconButton>
          <IconButton
            label={block.is_active ? "Hide block" : "Show block"}
            onClick={onToggle}
            disabled={pending}
          >
            {block.is_active ? "Hide" : "Show"}
          </IconButton>
          <IconButton label="Edit block" onClick={() => setEditing((v) => !v)}>
            {editing ? "Close" : "Edit"}
          </IconButton>
          <IconButton label="Delete block" onClick={onDelete} disabled={pending} danger>
            Delete
          </IconButton>
        </div>
      </div>
      {editing && (
        <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-900">
          <EditBlockForm block={block} onSaved={() => setEditing(false)} />
        </div>
      )}
    </li>
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
      className={`rounded px-1.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
          {pending ? "Adding…" : "Add block"}
        </Button>
      </form>
    </Card>
  );
}
