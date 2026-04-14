"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
import styles from "./MessageFeedback.module.css";

export type FeedbackType = "like" | "dislike" | null;

interface MessageFeedbackProps {
  messageId: string;
  conversationId: string;
  onSubmitFeedback?: (feedback: FeedbackType, text?: string) => Promise<void>;
  isLoading?: boolean;
}

export default function MessageFeedback({
  messageId,
  conversationId,
  onSubmitFeedback,
  isLoading = false,
}: MessageFeedbackProps) {
  const [currentFeedback, setCurrentFeedback] = useState<FeedbackType>(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedback = async (feedback: FeedbackType) => {
    setCurrentFeedback(feedback);
    if (feedback === "dislike") {
      setShowFeedbackForm(true);
    } else if (onSubmitFeedback) {
      setIsSubmitting(true);
      try {
        await onSubmitFeedback(feedback);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleSubmitFeedbackForm = async () => {
    if (onSubmitFeedback) {
      setIsSubmitting(true);
      try {
        await onSubmitFeedback(currentFeedback, feedbackText);
        setShowFeedbackForm(false);
        setFeedbackText("");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className={styles.feedbackContainer}>
      <div className={styles.feedbackButtons}>
        <button
          className={`${styles.feedbackButton} ${styles.like} ${
            currentFeedback === "like" ? styles.active : ""
          }`}
          onClick={() => handleFeedback("like")}
          disabled={isLoading || isSubmitting}
          title="Adorei essa!"
          aria-label="Adorei essa!"
        >
          <ThumbsUp size={16} />
          <span>Cuki 💚</span>
        </button>

        <button
          className={`${styles.feedbackButton} ${styles.dislike} ${
            currentFeedback === "dislike" ? styles.active : ""
          }`}
          onClick={() => handleFeedback("dislike")}
          disabled={isLoading || isSubmitting}
          title="Poderia melhorar"
          aria-label="Poderia melhorar"
        >
          <ThumbsDown size={16} />
          <span>Hmm, poderia melhorar 🤔</span>
        </button>
      </div>

      {showFeedbackForm && currentFeedback === "dislike" && (
        <div className={styles.feedbackForm}>
          <div className={styles.formHeader}>
            <MessageSquare size={16} />
            <span>Fala aí, o que posso melhorar? 🎯</span>
          </div>

          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Ex: 'Muito formal', 'Precisa de código', 'Muito longo'... (opcional)"
            className={styles.feedbackTextarea}
            rows={3}
            disabled={isSubmitting}
          />

          <div className={styles.feedbackHint}>
            💡 Diga se foi muito: formal/casual, longo/curto, técnico/simples, teórico/prático
          </div>

          <div className={styles.formActions}>
            <button
              className={`${styles.formButton} ${styles.cancel}`}
              onClick={() => {
                setShowFeedbackForm(false);
                setFeedbackText("");
                setCurrentFeedback(null);
              }}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              className={`${styles.formButton} ${styles.submit}`}
              onClick={handleSubmitFeedbackForm}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Enviando..." : "Enviar Feedback"}
            </button>
          </div>

          <div className={styles.feedbackNote}>
            <p>
              🎯 Cada feedback te torna especial pra mim! Vou aprender suas 
              preferências e as próximas respostas vão ser muito mais alinhadas 
              com o que você espera. Confia! 💚
            </p>
          </div>
        </div>
      )}

      {currentFeedback && !showFeedbackForm && (
        <div className={`${styles.feedbackMessage} ${styles[currentFeedback]}`}>
          {currentFeedback === "like"
            ? "✨ Yesss! Adorei saber que foi bom! Vou fazer mais assim 💚"
            : "🎯 Anotado! Vou caprichar nas próximas pra você amar 🚀"}
        </div>
      )}
    </div>
  );
}
