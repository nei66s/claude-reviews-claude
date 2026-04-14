"use client";

export function registerCommandPaletteHotkey(handler: () => void) {
  const listener = (event: KeyboardEvent) => {
    const isMetaShortcut = event.metaKey || event.ctrlKey;
    if (!isMetaShortcut || event.key.toLowerCase() !== "k") {
      return;
    }

    const target = event.target as HTMLElement | null;
    const editable =
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      target?.isContentEditable;

    event.preventDefault();

    if (editable || !editable) {
      handler();
    }
  };

  window.addEventListener("keydown", listener);
  return () => window.removeEventListener("keydown", listener);
}
