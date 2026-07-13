"use client";

import { ChevronLeft, ChevronRight, Pencil, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboardStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 40;

interface TabBarProps {
  onTabChange?: (key: string) => void;
  compact?: boolean;
}

export function TabBar({ onTabChange, compact = false }: TabBarProps) {
  const summaryTabs = useDashboardStore((s) => s.summaryTabs);
  const activeTabKey = useDashboardStore((s) => s.activeTabKey);
  const tabRenames = useDashboardStore((s) => s.tabRenames);
  const setActiveTabKey = useDashboardStore((s) => s.setActiveTabKey);
  const renameTab = useDashboardStore((s) => s.renameTab);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return summaryTabs;
    return summaryTabs.filter((g) => {
      const custom = tabRenames[g.key]?.toLowerCase() ?? "";
      return g.label.toLowerCase().includes(q) || custom.includes(q);
    });
  }, [search, summaryTabs, tabRenames]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    if (!activeTabKey && summaryTabs.length > 0) {
      setActiveTabKey(summaryTabs[0].key);
      onTabChange?.(summaryTabs[0].key);
    }
  }, [activeTabKey, onTabChange, setActiveTabKey, summaryTabs]);

  useEffect(() => {
    setPage(0);
  }, [search]);

  const displayName = (key: string, label: string) => tabRenames[key]?.trim() || label;

  const startEdit = (key: string, label: string) => {
    setEditingKey(key);
    setEditValue(displayName(key, label));
  };

  const commitEdit = () => {
    if (editingKey) {
      renameTab(editingKey, editValue);
      setEditingKey(null);
    }
  };

  return (
    <div className={cn("space-y-2", compact && "space-y-2")}>
      <div className={cn("flex gap-3", compact ? "items-center" : "flex-col sm:flex-row sm:items-center sm:justify-between")}>
        <div className={cn("relative", compact ? "w-48 shrink-0" : "max-w-sm flex-1")}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className={cn("pl-9", compact && "h-8 text-sm")}
            placeholder="Tìm tab..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {!compact && (
          <p className="text-sm text-muted-foreground">{filtered.length} tab đang chọn</p>
        )}
        {compact && (
          <p className="ml-auto shrink-0 text-xs text-muted-foreground">{filtered.length} tab</p>
        )}
      </div>

      <div className={cn("flex gap-2", compact ? "overflow-x-auto pb-1" : "flex-wrap")}>
        {visible.map((group) => {
          const isActive = activeTabKey === group.key;
          const isEditing = editingKey === group.key;

          return (
            <div key={group.key} className="group relative">
              {isEditing ? (
                <Input
                  autoFocus
                  className="h-9 w-40"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit();
                    if (e.key === "Escape") setEditingKey(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTabKey(group.key);
                    onTabChange?.(group.key);
                  }}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border px-3 text-sm transition-colors shrink-0",
                    compact ? "h-8" : "h-9",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-accent",
                  )}
                >
                  <span className="max-w-[160px] truncate">{displayName(group.key, group.label)}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    className={cn("rounded p-0.5 opacity-70 hover:opacity-100", isActive && "text-primary-foreground")}
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(group.key, group.label);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.stopPropagation();
                        startEdit(group.key, group.label);
                      }
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Trang {page + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
