"use client";

import { useCallback, useEffect, useRef } from "react";
import { showToast } from "../hooks/useToast";

interface UrubuChaosEngineProps {
  activeAgentId?: string | null;
  isStreaming?: boolean;
}

const CHAOS_MESSAGES = [
  { title: "SISTEMA COMPROMETIDO", description: "Detectada tentativa de rastreamento de IP pela Urubu Corp.", tone: "danger" as const },
  { title: "ALERTA DE SEGURANÇA", description: "O Urubu do Pix está tentando acessar os números da sua conta.", tone: "danger" as const },
  { title: "INVESTIGAÇÃO ATIVA", description: "Agentes da Urubu Corp iniciaram monitoramento de tráfego local.", tone: "danger" as const },
  { title: "DADOS EM RISCO", description: "Tentativa de sequestro de dados criptografados em andamento.", tone: "danger" as const },
  { title: "PIX RECEBIDO: R$ 0,01", description: "Mensagem: 'Paga o que deve, humano! Hahaha!'", tone: "info" as const },
  { title: "PIX RECEBIDO: R$ 0,01", description: "Mensagem: 'Taxa de proteção da Urubu Corp.'", tone: "info" as const },
  { title: "GRITO NO TERMINAL", description: "Jorginho: 'SAI DAQUI, PÁSSARO MALDITO! VAI TRABALHAR!'", tone: "error" as const },
  { title: "SEGURANÇA ATIVA", description: "Jorginho está varrendo o terminal com uma lanterna fraca.", tone: "info" as const },
  { title: "CONEXÃO INSTÁVEL", description: "Interferência eletromagnética detectada no servidor Pimpotasma.", tone: "danger" as const }
];

export default function UrubuChaosEngine({ activeAgentId, isStreaming }: UrubuChaosEngineProps) {
  const lastActiveRef = useRef<string | null>(null);
  const chaosTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerChaos = useCallback(() => {
    const msg = CHAOS_MESSAGES[Math.floor(Math.random() * CHAOS_MESSAGES.length)];
    showToast({
      tone: msg.tone || "danger",
      title: msg.title,
      description: msg.description,
    });
  }, []);

  useEffect(() => {
    const isUrubu = activeAgentId === "urubudopix";
    
    // Toggle global body class for CSS visual effects
    if (isUrubu) {
      document.body.classList.add("urubutopia-active");
    } else {
      document.body.classList.remove("urubutopia-active");
    }

    // Trigger chaotic notifications when Urubu starts talking or during streaming
    if (isUrubu && isStreaming && activeAgentId !== lastActiveRef.current) {
      // First wave
      triggerChaos();
    }

    // If urubu stays active, trigger random noises every 8-20 seconds
    if (isUrubu) {
      const scheduleNext = () => {
        const delay = 6000 + Math.random() * 10000;
        chaosTimeoutRef.current = setTimeout(() => {
          if (document.body.classList.contains("urubutopia-active")) {
            triggerChaos();
            
            // Randomly trigger extreme screen glitch
            if (Math.random() > 0.4) {
              document.body.classList.add("glitching");
              setTimeout(() => document.body.classList.remove("glitching"), 1000);
            }
            
            scheduleNext();
          }
        }, delay);
      };
      
      if (!chaosTimeoutRef.current) scheduleNext();
    } else {
      if (chaosTimeoutRef.current) {
        clearTimeout(chaosTimeoutRef.current);
        chaosTimeoutRef.current = null;
      }
    }

    lastActiveRef.current = activeAgentId || null;
    
    return () => {
      if (chaosTimeoutRef.current) clearTimeout(chaosTimeoutRef.current);
    };
  }, [activeAgentId, isStreaming, triggerChaos]);

  return (
    <div className={`chaos-overlay ${activeAgentId === "urubudopix" ? "active" : ""}`}>
      <div className="chaos-scanline" />
    </div>
  );
}
