"use client";

import React, { useState } from "react";
import Image from "next/image";
import EasterEggModal from "./EasterEggModal";

/**
 * PimpotasmaTeamCard Component
 * 
 * @description Displays the Pimpotasma Labs team information card with easter egg interactions
 * 
 * Easter Eggs:
 * 1. **Triple-Click Pimpim Card** (👑 interaction)
 *    - Click the Pimpim card 3 times to trigger "Sabedoria do Pimpim"
 *    - Displays random wisdom quote from 7 available quotes
 *    - Visual feedback: click counter appears on card, hover effects enabled
 * 
 * 2. **Click Chocks Quote** (Quote line interaction)
 *    - Click the quote: "Sou lindo, namorado da Betinha, ja fiz frete" — Chocks, 2026
 *    - Opens Chocks gallery showing 4 randomized attributes with emojis
 *    - Visual feedback: color change on hover, tooltip indicates clickability
 * 
 * @component
 */
export function PimpotasmaTeamCard() {
  // Modal state: tracks which easter egg modal is currently displayed
  const [modal, setModal] = useState<"pimpim_quotes" | "chocks_gallery" | "unleashed" | "none">("none");
  const [modalSeed, setModalSeed] = useState<number>(1);
  
  // Click counter for triple-click detection on Pimpim card
  const [clickCount, setClickCount] = useState(0);

  /**
   * Handles clicks on the Pimpim card
   * Increments counter and opens Pimpim quotes modal on 3rd click
   */
  const handlePimpimClick = () => {
    setClickCount((prev) => {
      const newCount = prev + 1;
      if (newCount >= 3) {
        setModalSeed(Math.floor(Math.random() * 1_000_000_000));
        setModal("pimpim_quotes");
        return 0;
      }
      return newCount;
    });
  };

  /**
   * Handles clicks on the Chocks quote line
   * Opens Chocks attribute gallery modal
   */
  const handleChocksClick = () => {
    setModalSeed(Math.floor(Math.random() * 1_000_000_000));
    setModal("chocks_gallery");
  };
  return (
    <div style={{
      borderRadius: '12px',
      background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)',
      border: '2px solid rgba(236, 72, 153, 0.3)',
      padding: '20px',
      marginTop: '16px',
      backdropFilter: 'blur(10px)',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#ec4899',
          marginBottom: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          🎪 Pimpotasma Labs
        </div>
        <div style={{
          fontSize: '12px',
          color: 'var(--muted)',
          fontStyle: 'italic',
        }}>
          &ldquo;Onde o caos vira código&rdquo;
        </div>
      </div>

      {/* CEO Card */}
      <div
        onClick={handlePimpimClick}
        style={{
          background: 'rgba(139, 92, 246, 0.1)',
          borderRadius: '10px',
          padding: '12px',
          marginBottom: '12px',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          position: 'relative',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = 'rgba(139, 92, 246, 0.15)';
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.2)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = 'rgba(139, 92, 246, 0.1)';
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        }}
        title="Clique 3x para sabedoria do Pimpim"
      >
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
          backgroundColor: '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Image
            src="/pimpim.png"
            alt="Pimpim - CEO"
            width={48}
            height={48}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--text)',
            marginBottom: '2px',
          }}>
            👑 Pimpim
          </div>
          <div style={{
            fontSize: '11px',
            color: 'var(--muted)',
          }}>
            CEO & Amiguinho do Chocks
          </div>
          <div style={{
            fontSize: '10px',
            color: '#ec4899',
            marginTop: '4px',
            fontStyle: 'italic',
          }}>
            &ldquo;Burrinho fofo, visionário&rdquo;
          </div>
        </div>
        {clickCount > 0 && (
          <div style={{
            fontSize: '10px',
            color: '#8b5cf6',
            fontWeight: '600',
            position: 'absolute',
            top: '4px',
            right: '8px',
            opacity: 0.6,
          }}>
            +{clickCount}
          </div>
        )}
      </div>

      {/* Betinha Card - CFO */}
      <div
        style={{
          background: 'rgba(236, 72, 153, 0.1)',
          borderRadius: '10px',
          padding: '12px',
          marginBottom: '12px',
          border: '1px solid rgba(236, 72, 153, 0.3)',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = 'rgba(236, 72, 153, 0.15)';
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(236, 72, 153, 0.2)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = 'rgba(236, 72, 153, 0.1)';
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        }}
      >
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
          backgroundColor: '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Image
            src="/betinha-avatar.jpg"
            alt="Betinha - CFO"
            width={48}
            height={48}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--text)',
            marginBottom: '2px',
          }}>
            💕 Betinha
          </div>
          <div style={{
            fontSize: '11px',
            color: 'var(--muted)',
          }}>
            CFO & Namorada do Chocks
          </div>
          <div style={{
            fontSize: '10px',
            color: '#10b981',
            marginTop: '4px',
            fontStyle: 'italic',
          }}>
            &ldquo;Executiva inteligente e carinhosa&rdquo;
          </div>
        </div>
      </div>

      {/* Team Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        marginBottom: '12px',
      }}>
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          borderRadius: '8px',
          padding: '8px',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#10b981' }}>9</div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>Familiares</div>
        </div>
        <div style={{
          background: 'rgba(236, 72, 153, 0.1)',
          borderRadius: '8px',
          padding: '8px',
          border: '1px solid rgba(236, 72, 153, 0.2)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#ec4899' }}>∞</div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>Risadas</div>
        </div>
      </div>

      {/* Fun Facts */}
      <div style={{
        background: 'rgba(251, 146, 60, 0.05)',
        borderRadius: '8px',
        padding: '10px',
        border: '1px solid rgba(251, 146, 60, 0.2)',
      }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#fb923c', marginBottom: '6px' }}>
          🎯 Missão da Pimpotasma:
        </div>
        <div style={{
          fontSize: '10px',
          color: 'var(--muted)',
          lineHeight: '1.4',
        }}>
          Trazer caos controlado para a tecnologia enquanto come frete e faz piadas.
        </div>
      </div>

      {/* Footer Quote */}
      <div
        onClick={handleChocksClick}
        style={{
          marginTop: '12px',
          fontSize: '11px',
          color: 'var(--muted)',
          fontStyle: 'italic',
          textAlign: 'center',
          borderTop: '1px solid rgba(139, 92, 246, 0.2)',
          paddingTop: '12px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.color = '#10b981';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.color = 'var(--muted)';
        }}
        title="Clique para galeria do Chocks"
      >
        &ldquo;Sou lindo, namorado da Betinha, ja fiz frete&rdquo; — Chocks, 2026
      </div>

      <EasterEggModal
        isOpen={modal !== "none"}
        onClose={() => setModal("none")}
        type={modal}
        seed={modalSeed}
      />
    </div>
  );
}

export default PimpotasmaTeamCard;
