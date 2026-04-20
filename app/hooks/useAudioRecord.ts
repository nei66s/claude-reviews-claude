import { useState, useRef, useCallback, useEffect } from "react";

type UseAudioRecordProps = {
  chatId?: string;
  onTranscription: (text: string) => void;
  onError: (error: string) => void;
};

export function useAudioRecord({ chatId, onTranscription, onError }: UseAudioRecordProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isCanceledRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Garantir cleanup correto dos tracks quando houver desmontagem
  const cleanupTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || mediaRecorderRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      isCanceledRef.current = false;
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : MediaRecorder.isTypeSupported('audio/mp4') 
          ? 'audio/mp4' 
          : ''; // Fallback padrão do navegador

      const mediaRecorder = mimeType 
        ? new MediaRecorder(stream, { mimeType }) 
        : new MediaRecorder(stream);
        
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        const type = mimeType || 'audio/mp4'; 
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        cleanupTracks();

        if (blob.size === 0 || isCanceledRef.current) {
          isCanceledRef.current = false;
          return;
        }

        setIsProcessing(true);
        try {
          const formData = new FormData();
          const ext = type.includes('webm') ? 'webm' : 'mp4';
          formData.append("file", blob, `audio_input.${ext}`);
          if (chatId) {
            formData.append("chatId", chatId);
          }

          const token = localStorage.getItem("chocks_token");
          const res = await fetch("/api/audio/transcription", {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body: formData,
          });

          if (!res.ok) {
             const json = await res.json().catch(() => ({}));
             throw new Error(json.error || "Falha ao processar o áudio");
          }

          const data = await res.json();
          if (data.text) {
             onTranscription(data.text);
          }
        } catch (err) {
          const error = err as { message?: string };
          onError(error.message || "Erro na transcrição de áudio.");
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (_err) {
      onError("Não foi possível acessar seu microfone. Verifique as permissões.");
      cleanupTracks();
    }
  }, [chatId, onTranscription, onError, isRecording, cleanupTracks]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      isCanceledRef.current = true;
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  useEffect(() => {
    return () => cleanupTracks();
  }, [cleanupTracks]);

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    cancelRecording
  };
}
