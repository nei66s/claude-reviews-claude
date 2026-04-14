"use client";

import { useEffect, useMemo, useState } from "react";

import { registerCommandPaletteHotkey } from "../utils/hotkeyListener";

export type CommandPaletteItem = {
  id: string;
  label: string;
  description: string;
  category: string;
  keywords?: string[];
  shortcut?: string;
  icon?: string;
};

const RECENT_KEY = "chocks-command-palette-recent";

function readRecentItems() {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeRecentItems(items: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 8)));
}

export function useCommandPalette(items: CommandPaletteItem[]) {
  const [open, setOpenState] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>(() => readRecentItems());

  const setOpen = (value: boolean | ((current: boolean) => boolean)) => {
    setOpenState((current) => {
      const nextValue = typeof value === "function" ? value(current) : value;
      if (!nextValue) {
        setQuery("");
        setSelectedIndex(0);
      }
      return nextValue;
    });
  };

  useEffect(() => registerCommandPaletteHotkey(() => setOpen((current) => !current)), []);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const ranked = items
      .map((item) => {
        const haystack = [
          item.label,
          item.description,
          item.category,
          ...(item.keywords || []),
        ]
          .join(" ")
          .toLowerCase();

        const matches = !normalizedQuery || haystack.includes(normalizedQuery);
        const recentBoost = recentIds.includes(item.id) ? 10 : 0;
        const prefixBoost = item.label.toLowerCase().startsWith(normalizedQuery) ? 5 : 0;
        return {
          item,
          matches,
          score: recentBoost + prefixBoost,
        };
      })
      .filter((entry) => entry.matches)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label));

    return ranked.map((entry) => entry.item);
  }, [items, query, recentIds]);

  const recentItems = useMemo(
    () => recentIds.map((id) => items.find((item) => item.id === id)).filter(Boolean) as CommandPaletteItem[],
    [items, recentIds],
  );

  const markUsed = (itemId: string) => {
    const next = [itemId, ...recentIds.filter((id) => id !== itemId)];
    setRecentIds(next);
    writeRecentItems(next);
  };

  return {
    open,
    setOpen,
    query,
    setQuery,
    selectedIndex,
    setSelectedIndex,
    filteredItems,
    recentItems,
    markUsed,
  };
}
