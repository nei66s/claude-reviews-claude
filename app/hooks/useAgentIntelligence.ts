
"use client";

import { useMemo, useState, useCallback } from "react";
import { Message } from "../lib/api";

export function useAgentIntelligence(messages: Message[]) {
  const [synergy, setSynergy] = useState(85);
  const [isLooping, setIsLooping] = useState(false);

  // Detecta loop verificando se as últimas 4 mensagens são muito similares
  const detectLoop = useCallback(() => {
    if (messages.length < 4) return false;
    
    const lastMsgs = messages.slice(-4).filter(m => !m.id?.startsWith("sys-"));
    if (lastMsgs.length < 3) return false;

    // Simplificação: se as mensagens têm palavras chaves repetidas e comprimentos parecidos
    const contents = lastMsgs.map(m => m.content.toLowerCase().trim());
    
    let similarityCount = 0;
    for (let i = 0; i < contents.length - 1; i++) {
      const words1 = new Set(contents[i].split(/\s+/));
      const words2 = new Set(contents[i+1].split(/\s+/));
      
      const intersection = [...words1].filter(w => words2.has(w));
      const overlap = intersection.length / Math.max(words1.size, words2.size);
      
      if (overlap > 0.6) similarityCount++;
    }

    return similarityCount >= 2;
  }, [messages]);

  // Calcula sinergia baseada no conteúdo (palavras positivas vs negativas/urubu)
  const calculateSynergy = useCallback(() => {
    if (messages.length === 0) return 85;

    const lastMsg = messages[messages.length - 1];
    const content = lastMsg.content.toLowerCase();
    
    let change = 0;
    if (lastMsg.agentId === "urubudopix") change = -15;
    else if (content.includes("golpe") || content.includes("pix") || content.includes("urubu")) change = -5;
    else if (content.includes("família") || content.includes("ajuda") || content.includes("bora") || content.includes("amo")) change = +5;
    else change = 1; // Recuperação natural

    setSynergy(prev => {
      const next = prev + change;
      return Math.min(100, Math.max(20, next));
    });
  }, [messages]);

  return {
    synergy,
    isLooping: detectLoop(),
    updateSynergy: calculateSynergy
  };
}
