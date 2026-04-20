import { useState, useCallback, useRef, useEffect } from "react";

export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const playTTS = useCallback(async (text: string, chatId?: string) => {
    cleanup();
    
    try {
      setIsGenerating(true);
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const token = localStorage.getItem("chocks_token");
      const res = await fetch("/api/audio/speech", {
        method: "POST",
        signal: abortController.signal,
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ text, chatId }),
      });

      if (!res.ok) {
        throw new Error("Falha ao gerar áudio TTS");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      activeUrlRef.current = url;
      setIsGenerating(false);

      const audio = new Audio(url);
      
      // Truque de UX: desabilitar preservação de pitch e aumentar a velociade
      // cria um leve 'chipmunk effect' (voz de esquilo/criança) nos navegadores suportados
      try {
        if ("preservesPitch" in audio) {
           (audio as unknown as { preservesPitch: boolean }).preservesPitch = false;
        }
        audio.playbackRate = 1.25;
      } catch (_err) {
        // Ignorar se o navegador não suportar
      }

      audioRef.current = audio;
      setIsPlaying(true);

      audio.onended = () => {
        setIsPlaying(false);
        if (activeUrlRef.current === url) cleanup();
      };

      audio.onerror = () => {
        setIsPlaying(false);
        if (activeUrlRef.current === url) cleanup();
      };

      await audio.play();
    } catch (err) {
      const e = err as { name?: string };
      if (e.name !== 'AbortError') {
        console.error(err);
      }
      setIsGenerating(false);
      setIsPlaying(false);
    }
  }, [cleanup]);

  const stopTTS = useCallback(() => {
    cleanup();
    setIsGenerating(false);
    setIsPlaying(false);
  }, [cleanup]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return { playTTS, stopTTS, isPlaying, isGenerating };
}
