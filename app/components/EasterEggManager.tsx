"use client";

import { useEffect, useState } from "react";
import EasterEggModal from "./EasterEggModal";

/**
 * EasterEggManager Component
 * 
 * @description Global keyboard listener for detecting and managing easter eggs
 * Runs at the top level of the application to capture keyboard events globally
 * 
 * Detects:
 * 1. Konami Code: ↑↑↓↓←→←→BA (classic video game cheat code)
 *    - Triggers: "PIMPOTASMA UNLEASHED!" modal with family messages
 * 
 * 2. Secret Words: "chocks", "pimpim", "betinha"
 *    - Maintains a 20-character buffer of typed characters
 *    - Detects word matches case-insensitively
 *    - Clears buffer on space or enter key
 * 
 * @example
 * // In AppShell.tsx or top-level component:
 * <EasterEggManager />
 * 
 * @component
 */
export function EasterEggManager() {
  const [konamiSequence, setKonamiSequence] = useState<string[]>([]);
  const [showUnleashed, setShowUnleashed] = useState(false);
  const [typedBuffer, setTypedBuffer] = useState("");

  const konamiCode = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase() === "b" || e.key.toLowerCase() === "a" ? e.key.toLowerCase() : e.code;

      // Konami Code Detection
      setKonamiSequence((prev) => {
        const newSequence = [...prev, key].slice(-konamiCode.length);
        if (newSequence.join(",") === konamiCode.join(",")) {
          setShowUnleashed(true);
          return [];
        }
        return newSequence;
      });

      // Secret Words Detection
      if (e.key.match(/^[a-zA-Z]$/)) {
        setTypedBuffer((prev) => {
          const newBuffer = (prev + e.key.toLowerCase()).slice(-20);

          if (newBuffer.includes("chocks") || newBuffer.includes("pimpim") || newBuffer.includes("betinha")) {
            const secretKey = newBuffer.includes("chocks") ? "chocks" : newBuffer.includes("pimpim") ? "pimpim" : "betinha";

            if (newBuffer.endsWith(secretKey)) {
              // Easter egg triggered
              if (secretKey === "chocks") {
                console.log("🎵 Chocks theme plays...");
                // Podemos adicionar confetti ou som aqui
              } else if (secretKey === "pimpim") {
                console.log("👑 Pimpim is watching...");
              } else if (secretKey === "betinha") {
                console.log("💕 Betinha approves!");
              }
              return "";
            }
          }
          return newBuffer;
        });
      } else if (e.key === " " || e.key === "Enter") {
        setTypedBuffer("");
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [konamiCode]);

  return (
    <>
      <EasterEggModal 
        isOpen={showUnleashed} 
        onClose={() => setShowUnleashed(false)} 
        type="unleashed" 
      />
    </>
  );
}

export default EasterEggManager;
