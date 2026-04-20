"use client";

/**
 * useRealtimeSession — V2 de voz via OpenAI Realtime API (WebRTC)
 *
 * Responsabilidades deste hook:
 *   - Criar/destruir sessão Realtime (via backend seguro)
 *   - Gerenciar conexão WebRTC + canal de dados
 *   - Controlar microfone (mute/unmute)
 *   - Reproduzir áudio de saída (baixa latência)
 *   - Bufferizar transcrições e textos de resposta
 *   - Persistir o turno via /api/audio/realtime/persist ao fim de cada response
 *   - Sinalizar fallback para V1 quando necessário
 *
 * Não responsabilidades:
 *   - Persistência direta (delega ao backend)
 *   - Gerenciamento de chat/mensagens (delega ao useChat)
 *   - Memória (delega ao Memory Orchestrator via backend)
 */

import { useState, useRef, useCallback, useEffect } from "react";

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export type RealtimeConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "listening"
  | "speaking"
  | "error"
  | "fallback";

export interface RealtimeSessionOptions {
  chatId: string;
  agentId?: string;
  token?: string | null;
  /** Callback: transcrição parcial do usuário (exibição ao vivo) */
  onPartialTranscript?: (text: string) => void;
  /** Callback: turno completo e persisted — recebe ids das mensagens */
  onTurnPersisted?: (params: {
    userMessageId: string | null;
    agentMessageId: string | null;
    userTranscript: string;
    assistantText: string;
  }) => void;
  /** Callback: texto parcial do assistant (exibição ao vivo) */
  onPartialAssistantText?: (text: string) => void;
  /** Callback disparado quando V2 falha e deve cair para V1 */
  onFallback?: (reason: string) => void;
  /** Callback de erro não fatal */
  onError?: (error: string) => void;
}

export interface RealtimeSessionControls {
  connectionState: RealtimeConnectionState;
  isMuted: boolean;
  partialTranscript: string;
  partialAssistantText: string;
  /** Inicia a sessão Realtime */
  connect: () => Promise<void>;
  /** Encerra a sessão e libera recursos */
  disconnect: () => void;
  /** Toggle do microfone (mute/unmute) */
  toggleMute: () => void;
  /** Interrompe o assistant que está falando (barge-in) */
  interrupt: () => void;
  /** Indica se uma sessão está ativa */
  isActive: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const EPHEMERAL_SESSION_URL = "/api/audio/realtime/session";
const PERSIST_URL = "/api/audio/realtime/persist";
const OPENAI_REALTIME_URL = "https://api.openai.com/v1/realtime";

/** Tempo máximo para aguardar ICE connection (ms) */
const ICE_TIMEOUT_MS = 12_000;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRealtimeSession(options: RealtimeSessionOptions): RealtimeSessionControls {
  const {
    chatId,
    agentId = "chocks",
    onPartialTranscript,
    onTurnPersisted,
    onPartialAssistantText,
    onFallback,
    onError,
    token,
  } = options;

  // ── Estado público ──────────────────────────────────────────────────────────
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [partialAssistantText, setPartialAssistantText] = useState("");

  // ── Refs internos (sem re-render) ───────────────────────────────────────────
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micSenderRef = useRef<RTCRtpSender | null>(null);

  /** Buffer do turno corrente — resetado a cada response.done */
  const pendingUserTranscript = useRef("");
  const pendingAssistantText = useRef("");

  /** Evita persistência dupla por turno */
  const persistLockRef = useRef(false);

  /** Evita reconexões paralelas */
  const connectingRef = useRef(false);

  /** FINAL_TURN_COMMIT: ID do turno atual. Unifica a intenção e a idempotência. */
  const currentTurnIdRef = useRef<string | null>(null);

  /** Impede commits de turnos que sofreram barge-in/foram interrompidos. */
  const abortedTurnsRef = useRef<Set<string>>(new Set());

  const emitFallback = useCallback(
    (reason: string) => {
      console.warn("[Realtime] Fallback para V1:", reason);
      setConnectionState("fallback");
      onFallback?.(reason);
    },
    [onFallback]
  );

  const emitError = useCallback(
    (err: string) => {
      console.error("[Realtime] Erro:", err);
      onError?.(err);
    },
    [onError]
  );

  // ── Limpeza de recursos ──────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    // Fechar data channel
    if (dataChannelRef.current) {
      try { dataChannelRef.current.close(); } catch { /* ignore */ }
      dataChannelRef.current = null;
    }

    // Fechar peer connection
    if (pcRef.current) {
      try { pcRef.current.close(); } catch { /* ignore */ }
      pcRef.current = null;
    }

    // Parar microfone
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    micSenderRef.current = null;

    // Parar áudio de saída
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }

    // Reset de buffers e tracking
    pendingUserTranscript.current = "";
    pendingAssistantText.current = "";
    persistLockRef.current = false;
    connectingRef.current = false;
    currentTurnIdRef.current = null;
    abortedTurnsRef.current.clear();

    setPartialTranscript("");
    setPartialAssistantText("");
  }, []);

  // ── FINAL_TURN_COMMIT (Persistência Oficial) ─────────────────────────────────

  const persistTurn = useCallback(
    async (turnId: string) => {
      // 1. Barrier: Ignorar se estiver abortado (Cancelamento Real)
      if (abortedTurnsRef.current.has(turnId)) {
        return;
      }
      
      // 2. Barrier: Concorrência local
      if (persistLockRef.current) return;
      
      const userTranscript = pendingUserTranscript.current.trim();
      const assistantText = pendingAssistantText.current.trim();

      // Reset dos buffers correntes APÓS copiar para o commit
      pendingUserTranscript.current = "";
      pendingAssistantText.current = "";

      if (!userTranscript && !assistantText) return;

      persistLockRef.current = true;

      try {
        const res = await fetch(PERSIST_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            chatId,
            agentId,
            userTranscript,
            assistantText,
            correlationId: turnId,
            title: "Conversa de voz",
          }),
        });


        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(errText || `HTTP ${res.status}`);
        }

        const data = await res.json();

        onTurnPersisted?.({
          userMessageId: data.userMessageId ?? null,
          agentMessageId: data.agentMessageId ?? null,
          userTranscript,
          assistantText,
        });
      } catch (err) {
        emitError(
          `Falha ao salvar turno de voz: ${err instanceof Error ? err.message : String(err)}`
        );
      } finally {
        persistLockRef.current = false;
      }
    },
    [chatId, agentId, token, onTurnPersisted, emitError]
  );

  // ── Processador de eventos Realtime ─────────────────────────────────────────

  const handleDataChannelMessage = useCallback(
    (event: MessageEvent) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }

      const type = msg.type as string;

      switch (type) {
        // Transcrição parcial do usuário
        case "conversation.item.input_audio_transcription.delta": {
          if (!currentTurnIdRef.current) {
            currentTurnIdRef.current = crypto.randomUUID();
          }
          const delta = (msg.delta as string) || "";
          pendingUserTranscript.current += delta;
          setPartialTranscript(pendingUserTranscript.current);
          onPartialTranscript?.(pendingUserTranscript.current);
          break;
        }

        // Transcrição final do usuário (whisper inline)
        case "conversation.item.input_audio_transcription.completed": {
          const transcript = ((msg.transcript as string) || "").trim();
          if (transcript) {
            pendingUserTranscript.current = transcript;
            setPartialTranscript(transcript);
            onPartialTranscript?.(transcript);
          }
          setConnectionState("speaking");
          break;
        }

        // Texto parcial do assistant
        case "response.text.delta": {
          const delta = (msg.delta as string) || "";
          pendingAssistantText.current += delta;
          setPartialAssistantText(pendingAssistantText.current);
          onPartialAssistantText?.(pendingAssistantText.current);
          break;
        }

        // Áudio do assistant começa
        case "response.audio.delta": {
          if (connectionState !== "speaking") {
            setConnectionState("speaking");
          }
          break;
        }

        // Turno completo do assistant — dispara persistência oficial
        case "response.done": {
          setConnectionState("listening");
          setPartialAssistantText("");

          const turnId = currentTurnIdRef.current || crypto.randomUUID();
          
          // FINAL_TURN_COMMIT: Ponto central de orquestração assíncrona
          persistTurn(turnId);
          
          currentTurnIdRef.current = null; // Preparar para o próximo
          break;
        }

        // Barge-in / resposta cancelada — abortar turno
        case "response.cancelled": {
          if (currentTurnIdRef.current) {
            abortedTurnsRef.current.add(currentTurnIdRef.current);
          }
          pendingAssistantText.current = "";
          setPartialAssistantText("");
          setConnectionState("listening");
          currentTurnIdRef.current = null;
          break;
        }

        // Usuário começou a falar (Marca o início formal da intenção)
        case "input_audio_buffer.speech_started": {
          setConnectionState("listening");
          if (!currentTurnIdRef.current) {
            currentTurnIdRef.current = crypto.randomUUID();
          }
          break;
        }

        // Erro retornado pelo Realtime
        case "error": {
          const errorMsg = (msg.message as string) || "Erro desconhecido na sessão Realtime";
          emitError(errorMsg);
          break;
        }
      }
    },
    [
      connectionState,
      persistTurn,
      onPartialTranscript,
      onPartialAssistantText,
      emitError,
    ]
  );

  // ── Conexão principal ────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (connectingRef.current || pcRef.current) return;
    connectingRef.current = true;
    setConnectionState("connecting");

    try {
      // 1. Solicitar acesso ao microfone antes de qualquer chamada de rede
      let micStream: MediaStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch {
        emitFallback("Sem permissão para acessar o microfone.");
        connectingRef.current = false;
        return;
      }
      micStreamRef.current = micStream;

      // 2. Criar sessão Realtime no backend (seguro — não expõe chave)
      let sessionData: {
        clientSecret?: { value?: string };
        sessionId?: string;
        model?: string;
        voice?: string;
      };

      try {
        const res = await fetch(EPHEMERAL_SESSION_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ chatId, agentId }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(errText || `HTTP ${res.status}`);
        }

        sessionData = await res.json();
      } catch (err) {
        micStream.getTracks().forEach((t) => t.stop());
        emitFallback(
          `Falha ao criar sessão Realtime: ${err instanceof Error ? err.message : String(err)}`
        );
        connectingRef.current = false;
        return;
      }

      const ephemeralKey = sessionData?.clientSecret?.value;
      if (!ephemeralKey) {
        micStream.getTracks().forEach((t) => t.stop());
        emitFallback("Backend não retornou token ephemeral.");
        connectingRef.current = false;
        return;
      }

      // 3. Criar RTCPeerConnection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // 4. Elemento de áudio para reprodução da resposta de voz
      const audioEl = new Audio();
      audioEl.autoplay = true;
      
      // Efeito 'Chocks': voz mais aguda e rápida (consistência com V1)
      try {
        if ("preservesPitch" in audioEl) {
          (audioEl as unknown as { preservesPitch: boolean }).preservesPitch = false;
        }
        audioEl.playbackRate = 1.25;
      } catch (_e) {
        // Fallback para original se o navegador não suportar
      }

      audioElRef.current = audioEl;

      pc.ontrack = (event) => {
        if (audioEl.srcObject !== event.streams[0]) {
          audioEl.srcObject = event.streams[0];
        }
      };

      // 5. Adicionar faixa de microfone
      const audioTrack = micStream.getAudioTracks()[0];
      if (audioTrack) {
        const sender = pc.addTrack(audioTrack, micStream);
        micSenderRef.current = sender;
      }

      // 6. Data channel para eventos Realtime
      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      dc.onopen = () => {
        setConnectionState("listening");
        connectingRef.current = false;
      };

      dc.onclose = () => {
        if (connectionState !== "fallback") {
          setConnectionState("idle");
        }
      };

      dc.onerror = () => {
        emitError("Data channel encerrou com erro.");
      };

      dc.onmessage = handleDataChannelMessage;

      // Troca de estado ICE
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === "failed" || state === "disconnected") {
          emitFallback(`ICE connection ${state}. Reconectando para V1.`);
          cleanup();
        }
      };

      // 7. SDP Offer → OpenAI Realtime
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Aguardar gathering completo com timeout
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("ICE gathering timeout")), ICE_TIMEOUT_MS);
        if (pc.iceGatheringState === "complete") {
          clearTimeout(timeout);
          resolve();
          return;
        }
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === "complete") {
            clearTimeout(timeout);
            resolve();
          }
        };
      }).catch((iceErr) => {
        throw iceErr;
      });

      // 8. Enviar SDP para OpenAI
      const model = sessionData.model || "gpt-4o-realtime-preview";
      const sdpRes = await fetch(`${OPENAI_REALTIME_URL}?model=${model}`, {
        method: "POST",
        body: pc.localDescription!.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpRes.ok) {
        throw new Error(`SDP exchange failed: HTTP ${sdpRes.status}`);
      }

      const remoteSdpText = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: remoteSdpText });

      setConnectionState("connected");
    } catch (err) {
      cleanup();
      emitFallback(
        `Erro ao conectar Realtime: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }, [chatId, agentId, token, handleDataChannelMessage, cleanup, emitFallback, emitError, connectionState]);

  // ── Controles públicos ───────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    cleanup();
    setConnectionState("idle");
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    if (!micSenderRef.current) return;
    const track = micSenderRef.current.track;
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
  }, []);

  /**
   * Barge-in: envia evento de cancelamento para o Realtime.
   * O buffer de texto do assistant é descartado e o turno atual é marcado como abortado.
   */
  const interrupt = useCallback(() => {
    const dc = dataChannelRef.current;
    if (!dc || dc.readyState !== "open") return;

    if (currentTurnIdRef.current) {
      abortedTurnsRef.current.add(currentTurnIdRef.current);
    }

    // Descartar buffer do assistant antes de cancelar
    pendingAssistantText.current = "";
    setPartialAssistantText("");

    dc.send(
      JSON.stringify({
        type: "response.cancel",
      })
    );
  }, []);

  // ── Cleanup ao desmontar ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    connectionState,
    isMuted,
    partialTranscript,
    partialAssistantText,
    connect,
    disconnect,
    toggleMute,
    interrupt,
    isActive: connectionState !== "idle" && connectionState !== "error" && connectionState !== "fallback",
  };
}
