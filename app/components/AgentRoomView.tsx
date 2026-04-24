
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
  const [lastSpeakerId, setLastSpeakerId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [currentTopic, setCurrentTopic] = useState<string | null>("Discussão Geral");

  // Pausa a sala se a aba não estiver visível
  useEffect(() => {
    const handleVisibility = () => setIsActive(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);
  const [speed] = useState(18000); // 18 segundos base (ajustado para ser um pouco mais rápido)
  const [isThinking, setIsThinking] = useState(false);
  const [isFetchingNews, setIsFetchingNews] = useState(false);
  const [isUserPresent, setIsUserPresent] = useState(true);
  const [expulsionVotes, setExpulsionVotes] = useState(0);
  const [lastKickTime, setLastKickTime] = useState<number>(0);
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

  // Carrega histórico e sincroniza periodicamente
  useEffect(() => {
    const syncHistory = async () => {
      try {
        const res = await fetch("/api/agent-room/history", {
          headers: { "Authorization": `Bearer ${localStorage.getItem("chocks_token")}` }
        });
        if (res.status === 401) return;
        const data = await res.json();
        if (data.messages?.length > 0) {
        // Sincroniza a lista de membros ativos baseada nas mensagens de sistema do histórico
        const systemMessages = data.messages.filter((m: any) => m.role === "system");
        const newActiveSet = new Set<AgentId>(AGENT_SEQUENCE.slice(0, 5)); // Base: Primeiros 5
        
        systemMessages.forEach((m: any) => {
          const joinedMatch = m.content.match(/(\w+) chegou na sala/);
          const leftMatch = m.content.match(/(\w+) saiu para resolver outros problemas/);
          if (joinedMatch) {
            const id = joinedMatch[1].toLowerCase() as AgentId;
            if (AGENT_SEQUENCE.includes(id)) newActiveSet.add(id);
          }
          if (leftMatch) {
            const id = leftMatch[1].toLowerCase() as AgentId;
            newActiveSet.delete(id);
          }
        });
        setActiveAgentIds(newActiveSet);

        // Sincroniza as mensagens se o conteúdo da última for diferente
          setMessages(prev => {
            const lastPrev = prev[prev.length - 1];
            const lastNew = data.messages[data.messages.length - 1];
            
            if (lastNew && lastPrev?.content !== lastNew.content) {
              return data.messages;
            }
            return prev;
          });
        }
      } catch (err) {
        console.error("Failed to sync history:", err);
      }
    };

    syncHistory(); // Primeiro load
    
    // Polling a cada 5 segundos para manter todos os usuários na mesma história
    const interval = setInterval(syncHistory, 5000);
    return () => clearInterval(interval);
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
  const inventFamilyNews = useCallback(async () => {
    const familyNews = [
      "Bento derrubou suco de uva no servidor central da Pimpotasma!",
      "Betinha convocou uma reunião de emergência para discutir a sinergia dos marshmallows.",
      "Pimpim encontrou um portal secreto para a dimensão do código limpo.",
      "Chubas está organizando um campeonato de ronco sincronizado no jardim.",
      "Chocks descobriu que as nuvens da Sala são feitas de algodão-doce.",
      "Alerta: O estoque de glitter da família está acabando criticamente!",
      "Vazamento: Alguém comeu o último pedaço do bolo de sardinha da Kitty.",
      "Bento desafiou o Urubu do Pix para um duelo de enigmas matemáticos.",
      "Miltinho está tentando explicar o que é a Web7 para o Jorginho.",
      "Isa postou uma foto da família que viralizou nas redes sociais.",
      "Repeteco começou a falar em rimas e ninguém consegue fazer ele parar.",
      "Chubaka está convencido de que o ponteiro que se mexe na tela é um pet fantasma."
    ];
    const picked = familyNews[Math.floor(Math.random() * familyNews.length)];
    setCurrentTopic(picked);

    const sysMsg: Message = {
      id: `sys-fam-news-${Date.now()}`,
      role: "system",
      content: `🏠 **EVENTO FAMILIAR:** ${picked}`,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, sysMsg].slice(-30));

    void fetch("/api/agent-room/persist", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("chocks_token")}` 
      },
      body: JSON.stringify({ role: "system", content: sysMsg.content })
    });

    showToast({ tone: "info", title: "Fofoca da Família", description: picked });
  }, []);

  // Busca notícia real quando há loop ou a cada 4 minutos
  const fetchRealNews = useCallback(async () => {
    if (isFetchingNews) return;
    
    // 50% de chance de ser uma notícia "inventada" (fofoca da família)
    if (Math.random() < 0.5) {
      inventFamilyNews();
      return;
    }

    setIsFetchingNews(true);
    
    try {
      const res = await fetch("/api/agent-room/news", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("chocks_token")}` }
      });
      if (res.status === 401) return;
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
    } finally {
      setIsFetchingNews(false);
    }
  }, [isFetchingNews, inventFamilyNews]);

  useEffect(() => {
    if (isLooping) {
      console.log("Loop detected! Injecting news...");
      fetchRealNews();
    }
  }, [isLooping, fetchRealNews]);

  // Injeção de notícias agora é centralizada no Worker de servidor

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

  const addEvent = useCallback(async (isEconomy: boolean = false) => {
    if (isThinking) return;

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
      let potentialAgents = activeList.filter(id => id !== lastSpeakerId);
      if (potentialAgents.length === 0) potentialAgents = activeList; // Fallback se sobrar um
      
      selectedAgentId = potentialAgents.length > 0 
        ? potentialAgents[Math.floor(Math.random() * potentialAgents.length)]
        : activeList[0];
        
      setLastSpeakerId(selectedAgentId);
    }
    
    setIsThinking(true);
    // Delay artificial mínimo menor em modo economia
    const delay = isEconomy ? 500 : (2000 + Math.random() * 2000);
    await new Promise(resolve => setTimeout(resolve, delay));
    
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
          activeAgents: activeList,
          lowPriority: isEconomy
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.warn("[AgentRoom] Unaunthorized to generate. Continuing in spectator mode.");
          return;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API Error ${response.status}: ${errorData.error || "Unknown error"}`);
      }
      const data = await response.json();

      // Se o servidor ignorou a geração (porque outro usuário já gerou ou tempo muito curto)
      if (data.skipped) {
        console.log("[AgentRoom] Generation skipped:", data.reason);
        return;
      }

      const newMsg: Message = {
        id: `msg-${Date.now()}`,
        role: "agent",
        agentId: data.agentId,
        content: data.content,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, newMsg].slice(-30));

      // Votação Automática: Se o Urubu está na sala e quem falou foi um agente "do bem", ele vota para expulsar
      if (activeAgentIds.has("urubudopix") && selectedAgentId !== "urubudopix") {
        // 40% de chance do agente votar contra o Urubu no turno dele
        if (Math.random() < 0.4) {
          kickUrubu();
          console.log(`[AgentRoom] ${selectedAgentId} votou contra o Urubu!`);
        }
      }

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
  }, [isThinking, activeAgentIds, messages, lastKickTime, votedAgentIds, kickUrubu, lastSpeakerId]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isMounted = true;

    const tick = async () => {
      if (!isMounted) return;
      
      const economy = !isUserPresent || !isActive;
      
      // Só dispara se não estiver pensando e estiver montado
      if (!isThinking) {
        await addEvent(economy);
      }

      // 10 minutos se em economia (token optimization), caso contrário usa a velocidade base
      const targetSpeed = economy ? 600000 : speed;
      const jitter = economy ? 1 : (0.8 + Math.random() * 0.8);
      
      if (isMounted) {
        timeoutId = setTimeout(tick, targetSpeed * jitter);
      }
    };

    // Inicia o primeiro ciclo um pouco mais rápido, mas sem isThinking como dependência direta
    timeoutId = setTimeout(tick, 3000);

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
    // Removido isThinking das dependências para evitar que a mudança de estado reinicie o timer precocemente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isUserPresent, speed, addEvent]);

  const urubuActive = activeAgentIds.has("urubudopix");

  return (
    <div className={`agent-room-container ${urubuActive ? "urubutopia-active" : ""}`}>
      {!isUserPresent && (
        <div className="economy-badge">
          🍃 MODO ECONOMIA ATIVO (IA EM BAIXA PRIORIDADE)
        </div>
      )}
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

      <RoomTicker 
        currentTopic={isFetchingNews ? "RECEBENDO ÚLTIMAS NOTÍCIAS..." : currentTopic} 
        isUrubuActive={urubuActive} 
        isFetching={isFetchingNews}
      />

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

        .economy-badge {
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(16, 185, 129, 0.2);
          border: 1px solid rgba(16, 185, 129, 0.4);
          color: #10b981;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.1em;
          z-index: 1000;
          backdrop-filter: blur(4px);
          pointer-events: none;
          animation: fade-in 0.5s ease-out;
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}
