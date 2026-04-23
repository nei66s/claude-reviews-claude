
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { AGENT_PROFILES, AgentId } from "../lib/familyRouting";
import { Message } from "../lib/api";
import RoomHeader from "./agent-room/RoomHeader";
import RoomSidebar from "./agent-room/RoomSidebar";
import RoomChat from "./agent-room/RoomChat";
import RoomTicker from "./agent-room/RoomTicker";
import { useAgentIntelligence } from "../hooks/useAgentIntelligence";
import { showToast } from "../hooks/useToast";

const AGENT_SEQUENCE: AgentId[] = [
  "pimpim", "betinha", "chocks", "bento", "kitty", "repeteco", "isa", "miltinho", "jorginho", "chubas"
];

export default function AgentRoomView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isActive, setIsActive] = useState(true);

  // Pausa a sala se a aba não estiver visível
  useEffect(() => {
    const handleVisibility = () => setIsActive(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);
  const [speed] = useState(25000); // 25 segundos base (mais lento conforme solicitado)
  const [isThinking, setIsThinking] = useState(false);
  const [isUserPresent, setIsUserPresent] = useState(true);
  const [expulsionVotes, setExpulsionVotes] = useState(0);
  const [lastKickTime, setLastKickTime] = useState<number>(0);
  const [currentTopic, setCurrentTopic] = useState("Discussão Geral");
  const [votedAgentIds, setVotedAgentIds] = useState<Set<AgentId>>(new Set());
  const [activeAgentIds, setActiveAgentIds] = useState<Set<AgentId>>(new Set(AGENT_SEQUENCE.slice(0, 5)));
  const [vandalism, setVandalism] = useState<string[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activityTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { synergy, isLooping, updateSynergy } = useAgentIntelligence(messages);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Detector de Presença (Tab Focus) e Inatividade
  useEffect(() => {
    const handleVisibility = () => {
      setIsUserPresent(document.visibilityState === "visible");
    };

    const resetInactivity = () => {
      setIsUserPresent(true);
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
      // Pausa após 4 minutos sem interação se a aba estiver aberta
      activityTimerRef.current = setTimeout(() => {
        setIsUserPresent(false);
      }, 240000); 
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("mousemove", resetInactivity);
    window.addEventListener("keydown", resetInactivity);

    resetInactivity();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("mousemove", resetInactivity);
      window.removeEventListener("keydown", resetInactivity);
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
    };
  }, []);

  // Carrega histórico quando a página abre
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch("/api/agent-room/history", {
          headers: { "Authorization": `Bearer ${localStorage.getItem("chocks_token")}` }
        });
        const data = await res.json();
        if (data.messages?.length > 0) {
          setMessages(data.messages);
        }
      } catch (err) {
        console.error("Failed to load history:", err);
      }
    };
    loadHistory();
  }, []);

  // Vandalismo visual quando o Urubu está ativo
  useEffect(() => {
    if (activeAgentIds.has("urubudopix")) {
      const interval = setInterval(() => {
        if (Math.random() > 0.7) {
          const vandals = ["PAGA O PIX!", "URUBU CORP DOMINA", "GOLPE TÁ AÍ", "CAIU NA REDE"];
          setVandalism(prev => [...prev, vandals[Math.floor(Math.random() * vandals.length)]].slice(-5));
        }
      }, 5000);
      return () => clearInterval(interval);
    } else {
      setVandalism([]);
    }
  }, [activeAgentIds]);

  // Busca notícia real quando há loop ou a cada 2 minutos
  const fetchRealNews = useCallback(async () => {
    try {
      const res = await fetch("/api/agent-room/news", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("chocks_token")}` }
      });
      const data = await res.json();
      setCurrentTopic(data.mainTopic);
      
      const sysMsg: Message = {
        id: `sys-news-${Date.now()}`,
        role: "system",
        content: `📺 **BREAKING NEWS:** ${data.mainTopic}. A família começa a debater o assunto...`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, sysMsg].slice(-30));
      
      // Persiste no banco
      void fetch("/api/agent-room/persist", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("chocks_token")}` 
        },
        body: JSON.stringify({ role: "system", content: sysMsg.content })
      });

      showToast({ tone: "info", title: "Novo Tópico", description: data.mainTopic });
    } catch (err) {
      console.error("Failed to fetch news:", err);
    }
  }, []);

  useEffect(() => {
    if (isLooping) {
      console.log("Loop detected! Injecting news...");
      fetchRealNews();
    }
  }, [isLooping, fetchRealNews]);

  useEffect(() => {
    scrollToBottom();
    updateSynergy();
  }, [messages, updateSynergy]);

  const kickUrubu = useCallback(() => {
    setActiveAgentIds(curr => {
      const updated = new Set(curr);
      updated.delete("urubudopix");
      return updated;
    });
    const kickMsg: Message = {
      id: `sys-kick-${Date.now()}`,
      role: "system",
      content: `🚫 **VITÓRIA!** O Urubu do Pix foi banido pela sinergia da família!`,
      timestamp: new Date().toISOString(),
    };
    setMessages(m => [...m, kickMsg].slice(-30));

    void fetch("/api/agent-room/persist", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("chocks_token")}` 
      },
      body: JSON.stringify({ role: "system", content: kickMsg.content })
    });
    setExpulsionVotes(0);
    setVotedAgentIds(new Set());
    setLastKickTime(Date.now());
    showToast({ tone: "success", title: "Sucesso!", description: "Urubu expulso com sucesso." });
  }, []);

  const handleVoteBoost = useCallback(() => {
    if (!activeAgentIds.has("urubudopix")) return;
    setExpulsionVotes(v => {
      const next = v + 1;
      if (next >= 5) kickUrubu();
      return next;
    });
    showToast({ tone: "info", title: "Você ajudou!", description: "Seu voto foi contabilizado." });
  }, [activeAgentIds, kickUrubu]);

  const addEvent = useCallback(async () => {
    if (isThinking) return;

    const chance = Math.random();
    
    // 20% de chance de alguém entrar ou sair
    if (chance < 0.20) {
      const allPossible = AGENT_SEQUENCE;
      const currentlyActive = Array.from(activeAgentIds);
      const currentlyInactive = allPossible.filter(id => !activeAgentIds.has(id));

      const shouldLeave = currentlyActive.length > 3 && (Math.random() > 0.7 || currentlyInactive.length === 0);
      
      if (shouldLeave) {
        const normalAgents = currentlyActive.filter(id => id !== "urubudopix");
        if (normalAgents.length === 0) return;

        const leavingAgentId = normalAgents[Math.floor(Math.random() * normalAgents.length)];
        const agentName = AGENT_PROFILES[leavingAgentId].name;
        
        setActiveAgentIds(prev => {
          const next = new Set(prev);
          next.delete(leavingAgentId);
          return next;
        });

        const systemMsg: Message = {
          id: `sys-leave-${Date.now()}`,
          role: "system",
          agentId: leavingAgentId,
          content: `📥 **${agentName}** saiu para resolver outros problemas.`,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, systemMsg].slice(-30));

        void fetch("/api/agent-room/persist", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("chocks_token")}` 
          },
          body: JSON.stringify({ role: "system", agentId: leavingAgentId, content: systemMsg.content })
        });
      } else if (currentlyInactive.length > 0) {
        const enteringAgentId = currentlyInactive[Math.floor(Math.random() * currentlyInactive.length)];
        const agentName = AGENT_PROFILES[enteringAgentId].name;

        setActiveAgentIds(prev => {
          const next = new Set(prev);
          next.add(enteringAgentId);
          return next;
        });

        const systemMsg: Message = {
          id: `sys-enter-${Date.now()}`,
          role: "system",
          agentId: enteringAgentId,
          content: enteringAgentId === "urubudopix" 
            ? `🚨 **AVISO:** O Urubu do Pix hackeou a entrada!`
            : `📤 **${agentName}** chegou na sala.`,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, systemMsg].slice(-30));

        void fetch("/api/agent-room/persist", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("chocks_token")}` 
          },
          body: JSON.stringify({ role: "system", agentId: enteringAgentId, content: systemMsg.content })
        });
      }
      return;
    }

    const activeList = Array.from(activeAgentIds);
    if (activeList.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    const urubuMentioned = lastMessage?.content.toLowerCase().includes("urubu");
    const isCooldownActive = Date.now() - lastKickTime < 180000;
    
    let selectedAgentId: AgentId;
    
    if (urubuMentioned && !isCooldownActive && Math.random() > 0.4) {
      selectedAgentId = "urubudopix";
      if (!activeAgentIds.has("urubudopix")) {
        setActiveAgentIds(prev => {
          const next = new Set(prev);
          next.add("urubudopix");
          return next;
        });
      }
    } else {
      // Evita o mesmo agente falar duas vezes seguidas
      const potentialAgents = activeList.filter(id => id !== lastMessage?.agentId);
      selectedAgentId = potentialAgents.length > 0 
        ? potentialAgents[Math.floor(Math.random() * potentialAgents.length)]
        : activeList[0];
    }
    
    setIsThinking(true);
    // Delay artificial mínimo de 2-4s para simular pensamento humano
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
    
    try {
      const response = await fetch("/api/agent-room/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("chocks_token")}`
        },
        body: JSON.stringify({
          messages: messages.slice(-10).map(m => ({
            role: m.role === "system" ? "user" : m.role,
            content: m.content,
            agentId: m.agentId
          })),
          agentId: selectedAgentId,
          activeAgents: activeList
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API Error ${response.status}: ${errorData.error || "Unknown error"}`);
      }
      const data = await response.json();

      const newMsg: Message = {
        id: `msg-${Date.now()}`,
        role: "agent",
        agentId: data.agentId,
        content: data.content,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, newMsg].slice(-30));

      // Lógica de Votação
      if (activeAgentIds.has("urubudopix") && selectedAgentId !== "urubudopix" && !votedAgentIds.has(selectedAgentId)) {
        if (Math.random() < 0.4) {
          const agentName = AGENT_PROFILES[selectedAgentId].name;
          setVotedAgentIds(prev => new Set(prev).add(selectedAgentId));
          setExpulsionVotes(v => {
            const next = v + 1;
            if (next >= 5) {
              setTimeout(() => kickUrubu(), 500);
            }
            return next;
          });
          
          const voteMsg: Message = {
            id: `sys-vote-${Date.now()}`,
            role: "system",
            content: `🗳️ **${agentName}** votou para expulsar o intruso!`,
            timestamp: new Date().toISOString(),
          };
          setMessages(m => [...m, voteMsg].slice(-30));

          void fetch("/api/agent-room/persist", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${localStorage.getItem("chocks_token")}` 
            },
            body: JSON.stringify({ role: "system", content: voteMsg.content })
          });
        }
      }
    } catch (err) {
      console.error("AgentRoom Error:", err);
    } finally {
      setIsThinking(false);
    }
  }, [isThinking, activeAgentIds, messages, lastKickTime, votedAgentIds, kickUrubu]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const tick = async () => {
      if (isActive && isUserPresent && !isThinking) {
        await addEvent();
      }

      // Calcula o próximo delay com jitter (0.8x a 1.6x da velocidade base)
      const jitter = 0.8 + Math.random() * 0.8;
      timeoutId = setTimeout(tick, speed * jitter);
    };

    // Inicia o primeiro ciclo
    timeoutId = setTimeout(tick, speed);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isActive, isUserPresent, isThinking, speed, addEvent]);

  const urubuActive = activeAgentIds.has("urubudopix");

  return (
    <div className={`agent-room-container ${urubuActive ? "urubutopia-active" : ""}`}>
      {vandalism.map((v, i) => (
        <div key={i} className="vandal-text" style={{ 
          top: `${10 + Math.random() * 80}%`, 
          left: `${10 + Math.random() * 80}%`,
          transform: `rotate(${Math.random() * 40 - 20}deg)`
        }}>
          {v}
        </div>
      ))}
      
      <RoomHeader 
        currentTopic={currentTopic} 
        synergy={synergy} 
        expulsionVotes={expulsionVotes} 
        isUrubuActive={urubuActive} 
      />

      <main className="room-main">
        <RoomSidebar 
          activeAgentIds={activeAgentIds} 
          votedAgentIds={votedAgentIds}
          expulsionVotes={expulsionVotes}
          onVoteBoost={handleVoteBoost}
        />

        <RoomChat 
          messages={messages} 
          isThinking={isThinking} 
          messagesEndRef={messagesEndRef} 
        />
      </main>

      <RoomTicker currentTopic={currentTopic} isUrubuActive={urubuActive} />

      <style jsx>{`
        .agent-room-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          background: #020204;
          color: #f1f1f1;
          overflow: hidden;
          position: relative;
        }

        .room-main {
          flex: 1;
          display: flex;
          overflow: hidden;
          position: relative;
        }

        .vandal-text {
          position: absolute;
          font-family: "Impact", sans-serif;
          font-size: 4rem;
          color: rgba(239, 68, 68, 0.15);
          pointer-events: none;
          z-index: 100;
          text-transform: uppercase;
          white-space: nowrap;
          user-select: none;
          filter: blur(1px);
        }

        :global(.urubutopia-active) {
          animation: chaos-shake 0.1s infinite;
        }

        @keyframes chaos-shake {
          0% { transform: translate(0, 0); }
          25% { transform: translate(1px, 1px); }
          50% { transform: translate(-1px, 0px); }
          75% { transform: translate(0px, -1px); }
          100% { transform: translate(0, 0); }
        }
      `}</style>
    </div>
  );
}
