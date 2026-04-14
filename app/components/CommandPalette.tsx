"use client";

import { useEffect, useRef } from "react";
import { Command, CornerDownLeft, Search } from "lucide-react";

import type { CommandPaletteItem } from "../hooks/useCommandPalette";

type CommandPaletteProps = {
  open: boolean;
  query: string;
  selectedIndex: number;
  items: CommandPaletteItem[];
  recentItems: CommandPaletteItem[];
  onQueryChange: (value: string) => void;
  onSelectedIndexChange: (value: number) => void;
  onClose: () => void;
  onRun: (item: CommandPaletteItem) => void;
};

export default function CommandPalette({
  open,
  query,
  selectedIndex,
  items,
  recentItems,
  onQueryChange,
  onSelectedIndexChange,
  onClose,
  onRun,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        onSelectedIndexChange(Math.min(selectedIndex + 1, Math.max(items.length - 1, 0)));
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        onSelectedIndexChange(Math.max(selectedIndex - 1, 0));
      }

      if (event.key === "Enter" && items[selectedIndex]) {
        event.preventDefault();
        onRun(items[selectedIndex]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [items, onClose, onRun, onSelectedIndexChange, open, selectedIndex]);

  if (!open) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette-modal" onClick={(event) => event.stopPropagation()}>
        <div className="command-palette-header">
          <div className="command-palette-icon-wrap">
            <Command size={18} />
          </div>
          <div className="command-palette-input-wrap">
            <Search size={16} />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Buscar ações, tools e atalhos..."
              aria-label="Buscar comandos"
            />
          </div>
          <div className="command-palette-hint">Esc</div>
        </div>

        {!query && recentItems.length > 0 ? (
          <div className="command-palette-section">
            <div className="command-palette-section-title">Recentes</div>
            <div className="command-palette-recent-row">
              {recentItems.slice(0, 4).map((item) => (
                <button key={item.id} type="button" className="command-palette-chip" onClick={() => onRun(item)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="command-palette-list" role="listbox" aria-label="Comandos disponíveis">
          {items.length === 0 ? (
            <div className="command-palette-empty">Nenhuma ação encontrada.</div>
          ) : (
            items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={selectedIndex === index}
                className={`command-palette-item ${selectedIndex === index ? "selected" : ""}`}
                onMouseEnter={() => onSelectedIndexChange(index)}
                onClick={() => onRun(item)}
              >
                <div className="command-palette-item-icon">{item.icon || item.category.slice(0, 1)}</div>
                <div className="command-palette-item-copy">
                  <div className="command-palette-item-topline">
                    <span>{item.label}</span>
                    <span className="command-palette-category">{item.category}</span>
                  </div>
                  <div className="command-palette-description">{item.description}</div>
                </div>
                <div className="command-palette-enter-hint">
                  {item.shortcut ? item.shortcut : <CornerDownLeft size={14} />}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
