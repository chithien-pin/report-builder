"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export interface ReportCardNavItem {
  id: string;
  label: string;
}

export function ReportCardNav({ items }: { items: ReportCardNavItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    if (items.length === 0) return;
    const observers: IntersectionObserver[] = [];
    const visible = new Map<string, number>();

    for (const item of items) {
      const el = document.getElementById(item.id);
      if (!el) continue;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;
          visible.set(item.id, entry.intersectionRatio);
          let bestId = items[0]?.id ?? "";
          let best = 0;
          for (const [id, ratio] of visible) {
            if (ratio > best) {
              best = ratio;
              bestId = id;
            }
          }
          if (best > 0) setActive(bestId);
        },
        { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.15, 0.35, 0.6, 1] },
      );
      observer.observe(el);
      observers.push(observer);
    }

    return () => observers.forEach((o) => o.disconnect());
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Điều hướng card"
      className="pointer-events-none fixed right-3 top-1/2 z-30 hidden w-44 -translate-y-1/2 lg:block"
    >
      <ul className="pointer-events-auto space-y-1 rounded-2xl border border-border/60 bg-card/95 p-2 shadow-[var(--shadow-soft)] backdrop-blur">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs transition-colors",
                active === item.id
                  ? "bg-lavender-soft font-semibold text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              onClick={() => {
                document.getElementById(item.id)?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
                setActive(item.id);
              }}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  active === item.id ? "bg-primary" : "bg-border",
                )}
              />
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
