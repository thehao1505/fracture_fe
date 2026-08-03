"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [{ href: "/dashboard", label: "My page" }];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <>
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`relative text-sm font-medium transition-colors ${
              active
                ? "text-zinc-900 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {link.label}
            {active && (
              <span className="absolute -bottom-[19px] left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-brand-from to-brand-to" />
            )}
          </Link>
        );
      })}
    </>
  );
}
