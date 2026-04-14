"use client";

import React, { useState } from "react";
import Image from "next/image";

/**
 * Props for the EasterEggModal component
 * @interface EasterEggModalProps
 */
interface EasterEggModalProps {
  /** Whether the modal is visible or hidden */
  isOpen: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** Type of easter egg content to display: pimpim_quotes | chocks_gallery | unleashed */
  type: "pimpim_quotes" | "chocks_gallery" | "unleashed" | "none";
}

/**
 * Array of Pimpim's wisdom quotes
 * Each quote represents CEO wisdom from Pimpim (the burrinho fofo CEO)
 * Displayed randomly when triple-clicking the Pimpim card
 */
const PIMPIM_QUOTES = [
  "Burro fofo é meu nome, código é minha missão! 🐴",
  "Cada frete é uma oportunidade de aprender... e comer 🍔",
  "Chocks é meu menininho, e vocês é meu time! 💪",
  "Na Pimpotasma, o caos é feature, não bug! 🎪",
  "Risadas, código, mais fretes — esse é o nosso stack 📚",
  "Burrinho fofo? Sim. CEO? Também. Ambos? Sempre! 👑",
  "A Betinha aprova essa mensagem 💕",
];

/**
 * Array of Chocks' attributes displayed in the gallery
 * Each item has a descriptive text and emoji representing an aspect of Chocks
 * Displayed randomized (4 of 8) when clicking the Chocks quote
 */
const CHOCKS_GALLERY = [
  { text: "Sou lindo", emoji: "✨" },
  { text: "Namorado da Betinha", emoji: "💕" },
  { text: "Já fiz frete", emoji: "📦" },
  { text: "Paixão por código", emoji: "💻" },
  { text: "Menininho fofo", emoji: "😊" },
  { text: "Dedicado ao trabalho", emoji: "🎯" },
  { text: "Jovem aprendiz", emoji: "🧠" },
  { text: "Equipe Pimpotasma", emoji: "🎪" },
];

/**
 * EasterEggModal Component
 * 
 * @description Displays three different types of modal dialogs for easter eggs:
 * - pimpim_quotes: Shows random CEO wisdom from Pimpim (triggered by triple-click)
 * - chocks_gallery: Shows randomized attributes of Chocks (triggered by clicking quote)
 * - unleashed: Shows "PIMPOTASMA UNLEASHED!" power mode (triggered by Konami code)
 * 
 * Features:
 * - Glassmorphic design with gradient borders and backdrop blur
 * - Smooth animations (slideIn 0.3s, spin 2s for Konami emoji)
 * - Click outside to close
 * - Randomized content selection
 * 
 * @example
 * <EasterEggModal 
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   type="pimpim_quotes"
 * />
 * 
 * @component
 */
export function EasterEggModal({ isOpen, onClose, type }: EasterEggModalProps) {
  const randomQuote = PIMPIM_QUOTES[Math.floor(Math.random() * PIMPIM_QUOTES.length)];
  const randomGallery = CHOCKS_GALLERY.sort(() => 0.5 - Math.random()).slice(0, 4);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "linear-gradient(135deg, rgba(236, 72, 153, 0.2) 0%, rgba(139, 92, 246, 0.15) 100%)",
          border: "2px solid rgba(236, 72, 153, 0.4)",
          borderRadius: "16px",
          padding: "32px",
          maxWidth: "500px",
          maxHeight: "80vh",
          overflowY: "auto",
          backdropFilter: "blur(10px)",
          color: "var(--text)",
          animation: "slideIn 0.3s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {type === "pimpim_quotes" && (
          <div>
            <div style={{ fontSize: "32px", marginBottom: "16px", textAlign: "center" }}>👑</div>
            <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", textAlign: "center", color: "#ec4899" }}>
              Sabedoria do Pimpim
            </h2>
            <div
              style={{
                fontSize: "16px",
                lineHeight: "1.6",
                color: "var(--muted)",
                marginBottom: "20px",
                textAlign: "center",
                fontStyle: "italic",
              }}
            >
              "{randomQuote}"
            </div>
            <div style={{ textAlign: "center", fontSize: "12px", color: "var(--muted-soft)" }}>
              Recarregue para outra sabedoria... 🎪
            </div>
          </div>
        )}

        {type === "chocks_gallery" && (
          <div>
            <div style={{ fontSize: "32px", marginBottom: "16px", textAlign: "center" }}>✨</div>
            <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", textAlign: "center", color: "#10b981" }}>
              Sobre o Chocks
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {randomGallery.map((item) => (
                <div
                  key={item.text}
                  style={{
                    background: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    borderRadius: "8px",
                    padding: "12px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "24px", marginBottom: "6px" }}>{item.emoji}</div>
                  <div style={{ fontSize: "12px", color: "var(--text)" }}>{item.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {type === "unleashed" && (
          <div>
            <div style={{ fontSize: "48px", marginBottom: "16px", textAlign: "center", animation: "spin 2s linear infinite" }}>
              🎪
            </div>
            <h2 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "16px", textAlign: "center", color: "#ec4899" }}>
              PIMPOTASMA UNLEASHED!
            </h2>
            <div style={{ fontSize: "14px", lineHeight: "1.6", marginBottom: "20px", color: "var(--muted)" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ fontSize: "20px" }}>🐴</div>
                <div>
                  <div style={{ fontWeight: "600", color: "var(--text)" }}>Pimpim:</div>
                  <p style={{ margin: 0 }}>"Ativa o caos!"</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ fontSize: "20px" }}>✨</div>
                <div>
                  <div style={{ fontWeight: "600", color: "var(--text)" }}>Chocks:</div>
                  <p style={{ margin: 0 }}>"Vamo trabalhar!"</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  flexShrink: 0,
                  backgroundColor: "#f3f4f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Image
                    src="/betinha-avatar.jpg"
                    alt="Betinha"
                    width={36}
                    height={36}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <div>
                  <div style={{ fontWeight: "600", color: "var(--text)" }}>Betinha:</div>
                  <p style={{ margin: 0 }}>"Com amor e dedicação!"</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div style={{ fontSize: "20px" }}>🎪</div>
                <div>
                  <div style={{ fontWeight: "600", color: "var(--text)" }}>Pimpotasma:</div>
                  <p style={{ margin: 0 }}>"PRONTA PARA TUDO!"</p>
                </div>
              </div>
            </div>
            <p style={{ textAlign: "center", fontSize: "12px", color: "#ec4899", fontWeight: "600" }}>
              Você descobriu a verdadeira força da Pimpotasma 💪
            </p>
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: "20px",
            width: "100%",
            padding: "10px 16px",
            background: "rgba(16, 185, 129, 0.2)",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            borderRadius: "8px",
            color: "#10b981",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.background = "rgba(16, 185, 129, 0.3)";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.background = "rgba(16, 185, 129, 0.2)";
          }}
        >
          Fechar
        </button>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export default EasterEggModal;
