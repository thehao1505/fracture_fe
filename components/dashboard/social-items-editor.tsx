"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SOCIAL_PLATFORMS, type SocialItem } from "@/lib/api/types";
import { Button, Input, Select } from "@/components/ui";

/**
 * Edits the §5 socials content: 1–20 items of { platform, url }. The composed
 * array is submitted as a JSON hidden field named "items".
 */
export function SocialItemsEditor({ initial }: { initial: SocialItem[] }) {
  const [items, setItems] = useState<SocialItem[]>(
    initial.length > 0 ? initial : [{ platform: "website", url: "" }],
  );

  const update = (index: number, patch: Partial<SocialItem>) => {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <Select
            aria-label="Platform"
            value={item.platform}
            onChange={(event) =>
              update(index, {
                platform: event.target.value as SocialItem["platform"],
              })
            }
            className="w-36"
          >
            {SOCIAL_PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </Select>
          <Input
            aria-label="URL"
            type="url"
            value={item.url}
            onChange={(event) => update(index, { url: event.target.value })}
            placeholder="https://…"
            className="flex-1"
          />
          <Button
            type="button"
            variant="danger"
            aria-label="Remove item"
            disabled={items.length <= 1}
            className="w-10 shrink-0 px-0"
            onClick={() =>
              setItems((current) => current.filter((_, i) => i !== index))
            }
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        disabled={items.length >= 20}
        onClick={() =>
          setItems((current) => [...current, { platform: "website", url: "" }])
        }
      >
        <Plus className="h-4 w-4" aria-hidden />
        Add social link {items.length >= 20 && "(max 20)"}
      </Button>
    </div>
  );
}
