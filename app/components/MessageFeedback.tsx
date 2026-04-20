"use client";

import { useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown, Volume2 } from "lucide-react";
import styles from "./MessageFeedback.module.css";

export type FeedbackType = "like" | "dislike" | null;

interface MessageFeedbackProps {
  messageId: string;
  conversationId: string;
  onSubmitFeedback?: (feedback: FeedbackType) => Promise<void>;
  onPlayAudio?: () => void;
  isLoading?: boolean;
  initialFeedback?: FeedbackType;
}

export default function MessageFeedback({
  messageId,
  conversationId,
  onSubmitFeedback,
  onPlayAudio,
  isLoading = false,
  initialFeedback = null,
}: MessageFeedbackProps) {
  const [currentFeedback, setCurrentFeedback] = useState<FeedbackType>(() => {
    return initialFeedback === "like" || initialFeedback === "dislike" ? initialFeedback : null;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialFeedback === "like" || initialFeedback === "dislike") {
      setCurrentFeedback(initialFeedback);
    }
  }, [initialFeedback, conversationId, messageId]);

  const handleFeedback = async (feedback: FeedbackType) => {
    if (currentFeedback === feedback) {
      setCurrentFeedback(null);
    } else {
      setCurrentFeedback(feedback);
    }
    
    if (onSubmitFeedback) {
      setIsSubmitting(true);
      try {
        await onSubmitFeedback(feedback === currentFeedback ? null : feedback);
      } catch (err) {
        console.error("Failed to submit feedback:", err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className={styles.feedbackContainer}>
      {onPlayAudio && (
        <button
          className={`${styles.feedbackButton}`}
          onClick={onPlayAudio}
          disabled={isLoading || isSubmitting}
          title="Ouvir resposta em áudio"
          aria-label="Ouvir áudio"
        >
          <Volume2 size={20} />
        </button>
      )}

      <button
        className={`${styles.feedbackButton} ${styles.like} ${
          currentFeedback === "like" ? styles.active : ""
        }`}
        onClick={() => handleFeedback("like")}
        disabled={isLoading || isSubmitting}
        title="Adorei"
        aria-label="Feedback positivo"
      >
        <ThumbsUp size={20} />
      </button>

      <button
        className={`${styles.feedbackButton} ${styles.dislike} ${
          currentFeedback === "dislike" ? styles.active : ""
        }`}
        onClick={() => handleFeedback("dislike")}
        disabled={isLoading || isSubmitting}
        title="Poderia melhorar"
        aria-label="Feedback negativo"
      >
        <ThumbsDown size={20} />
      </button>
    </div>
  );
}
