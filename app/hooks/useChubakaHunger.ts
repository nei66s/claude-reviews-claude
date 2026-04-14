"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { showToast } from "./useToast";

const HUNGER_TICK_INTERVAL = 3000; // Aumenta 1% a cada 3 segundos
const HUNGER_ACTION_INCREMENT = 10; // 10% por ação (mensagem, clique, etc)
const HUNGER_THRESHOLD = 100; // Quando atinge 100, mostra notificação
const SLEEP_DURATION_MS = 15 * 60 * 1000; // 15 minutos de sono

const HUNGER_CRIES = [
  { title: "🍗 Chubaka está MORRENDO de fome!", description: "Tia, tio... so presciso de um cuki... 🥺💔" },
  { title: "😫 FOMINHAAA!", description: "Não aguento mais... Betinha, me salva! 🍪" },
  { title: "🐕 CHUBAAAA QUER COMEEEER!", description: "To fraco... mal consigo latir... 😭" },
  { title: "💀 Chubaka está em estado crítico!", description: "Me dá um cuki rápido ou eu viro assombração! 👻" },
  { title: "🍖 POR FAVOOOOR!", description: "Chora, esperneia... to com uma fomi do tamanho do Betinha 😩" },
];

export function useChubakaHunger() {
  const [hungerLevel, setHungerLevel] = useState(0);
  const [hasShownNotification, setHasShownNotification] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [isInputBlocked, setIsInputBlocked] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const sleepTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Incrementa fome com o tempo (1% a cada 3 segundos = ~100% em 5 minutos)
  useEffect(() => {
    if (isSleeping) return; // Não aumenta fome se está dormindo

    intervalRef.current = setInterval(() => {
      setHungerLevel((prev) => {
        const newLevel = Math.min(prev + 1, HUNGER_THRESHOLD);
        return newLevel;
      });
    }, HUNGER_TICK_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isSleeping]);

  // Verifica quando atinge o máximo e mostra notificação
  useEffect(() => {
    if (hungerLevel >= HUNGER_THRESHOLD && !hasShownNotification && !isSleeping) {
      setHasShownNotification(true);
      setIsInputBlocked(true);

      // Escolha aleatória de frase dramática
      const randomCry = HUNGER_CRIES[Math.floor(Math.random() * HUNGER_CRIES.length)];
      
      showToast({
        tone: "info",
        title: randomCry.title,
        description: randomCry.description,
      });

      // Toca som dramático (Web Audio API)
      playHungerSound();

      // Desbloqueia input após 10s
      setTimeout(() => {
        setIsInputBlocked(false);
      }, 10000);

      // Reinicia a barra após a notificação
      setTimeout(() => {
        setHungerLevel(0);
        setHasShownNotification(false);
      }, 1000);
    }
  }, [hungerLevel, hasShownNotification, isSleeping]);

  // Carrega estado de sono do localStorage
  useEffect(() => {
    const savedSleepState = localStorage.getItem("chubaka_sleeping");
    if (savedSleepState === "true") {
      setIsSleeping(true);
    }
  }, []);

  // Som da fome (Web Audio API - grito dramático)
  const playHungerSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioContext.currentTime;
      
      // Cria uma série de bips dramáticos
      for (let i = 0; i < 3; i++) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.setValueAtTime(200 + i * 50, now + i * 0.2);
        osc.frequency.exponentialRampToValueAtTime(100, now + i * 0.2 + 0.15);
        
        gain.gain.setValueAtTime(0.3, now + i * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.15);
        
        osc.start(now + i * 0.2);
        osc.stop(now + i * 0.2 + 0.15);
      }
    } catch (e) {
      // Silent fail se Web Audio não estiver disponível
      console.debug("Web Audio API not available");
    }
  };

  // Função para incrementar fome por ação (mensagem, clique, etc)
  const addHungerFromAction = useCallback(() => {
    setHungerLevel((prev) => {
      const newLevel = Math.min(prev + HUNGER_ACTION_INCREMENT, HUNGER_THRESHOLD);
      return newLevel;
    });
  }, []);

  // Alimentar o Chubaka (reduz fome em 30%)
  const feedChubaka = useCallback(() => {
    if (isSleeping) {
      showToast({
        tone: "info",
        title: "😴 Chubaka está dormindo...",
        description: "Ele não quer ser acordado para comer agora. Deixa ele descansar! 💤",
      });
      return;
    }

    setHungerLevel((prev) => {
      const newLevel = Math.max(prev - 30, 0);
      return newLevel;
    });

    showToast({
      tone: "success",
      title: "🍪 Chubaka comeu e ficou feliz!",
      description: "Fome reduzida em 30% - Que cuki delicioso! 😋",
    });
  }, [isSleeping]);

  // Colocar Chubaka para dormir
  const putChubakaToSleep = useCallback(() => {
    setIsSleeping(true);
    setHungerLevel(0);
    setIsInputBlocked(false);
    localStorage.setItem("chubaka_sleeping", "true");
    
    showToast({
      tone: "success",
      title: "😴 Chubaka foi para a cama!",
      description: `Ele dormirá por ${Math.round(SLEEP_DURATION_MS / 60000)} minutos. Boa noite! 🌙`,
    });

    // Acorda automaticamente após SLEEP_DURATION_MS
    sleepTimeoutRef.current = setTimeout(() => {
      setIsSleeping(false);
      localStorage.removeItem("chubaka_sleeping");
      
      showToast({
        tone: "success",
        title: "⏰ Chubaka acordou!",
        description: "Nossa, que sono gostoso! Pronto pra trabalhar novamente! 🐕",
      });
    }, SLEEP_DURATION_MS);
  }, []);

  // Acordar Chubaka manualmente
  const wakeUpChubaka = useCallback(() => {
    if (sleepTimeoutRef.current) {
      clearTimeout(sleepTimeoutRef.current);
    }
    setIsSleeping(false);
    localStorage.removeItem("chubaka_sleeping");
    
    showToast({
      tone: "success",
      title: "👁️ Chubaka acordou cedo!",
      description: "Hummmm... que descansão! Bora trabalhar? 🚀",
    });
  }, []);

  // Reset manual da fome (para testes ou easter eggs)
  const resetHunger = useCallback(() => {
    setHungerLevel(0);
    setHasShownNotification(false);
    setIsInputBlocked(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sleepTimeoutRef.current) {
        clearTimeout(sleepTimeoutRef.current);
      }
    };
  }, []);

  return {
    hungerLevel,
    addHungerFromAction,
    feedChubaka,
    resetHunger,
    isSleeping,
    putChubakaToSleep,
    wakeUpChubaka,
    isInputBlocked,
  };
}
