import { Inbox } from "lucide-react";
import type {
  HeaderContent,
  LinkContent,
  PublicBlock,
  SocialsContent,
} from "@/lib/api/types";
import { HeaderBlock } from "./header-block";
import { LinkBlock } from "./link-block";
import { SocialsBlock } from "./socials-block";

/**
 * Renders a profile's blocks in order. A `header` block starts a new
 * `<section>` and labels it, so the page has real structure for screen
 * readers and assistive navigation instead of one flat list of links.
 */

interface Section {
  header: { id: string; text: string; index: number } | null;
  blocks: { block: PublicBlock; index: number }[];
}

function groupIntoSections(blocks: PublicBlock[]): Section[] {
  const sections: Section[] = [{ header: null, blocks: [] }];
  blocks.forEach((block, index) => {
    if (block.type === "header") {
      const { text } = block.content as HeaderContent;
      sections.push({ header: { id: `sec-${block.id}`, text, index }, blocks: [] });
      return;
    }
    sections[sections.length - 1].blocks.push({ block, index });
  });
  // Drop the leading bucket when the first block is already a header.
  return sections.filter(
    (section) => section.header || section.blocks.length > 0,
  );
}

export function ProfileBlocks({
  blocks,
}: {
  blocks: PublicBlock[];
}) {
  if (blocks.length === 0) {
    return (
      <div
        className="pf-reveal flex flex-col items-center gap-2 py-10"
        style={{ color: "var(--pf-muted)", animationDelay: "140ms" }}
      >
        <Inbox className="h-6 w-6 opacity-60" aria-hidden />
        <p className="text-sm">Nothing here yet.</p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-7">
      {groupIntoSections(blocks).map((section, sectionIndex) => (
        <section
          key={section.header?.id ?? `sec-${sectionIndex}`}
          aria-labelledby={section.header?.id}
          className="flex flex-col gap-3"
        >
          {section.header && (
            <HeaderBlock
              id={section.header.id}
              text={section.header.text}
              index={section.header.index}
            />
          )}
          {section.blocks.map(({ block, index }) =>
            block.type === "socials" ? (
              <SocialsBlock
                key={block.id}
                items={(block.content as SocialsContent).items}
                index={index}
              />
            ) : (
              /* §7.12 — server-mediated click: /go counts it, then redirects.
                 Relative to this user's own subdomain (proxy.ts) — no
                 username prefix, unlike the old path-based /{username}/go. */
              <LinkBlock
                key={block.id}
                href={`/go/${block.id}`}
                content={block.content as LinkContent}
                index={index}
              />
            ),
          )}
        </section>
      ))}
    </div>
  );
}
