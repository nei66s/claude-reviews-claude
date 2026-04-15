"use client";

import Image from "next/image";
import { Heart, MessageCircle, TrendingUp, AlertCircle } from "lucide-react";
import styles from "./DoutorKittyDashboard.module.css";
import type { KittyInterpretation } from "@/lib/server/doutora-kitty";

interface DoutorKittyDashboardProps {
  interpretation: KittyInterpretation | null;
  isLoading?: boolean;
}

export default function DoutorKittyDashboard({
  interpretation,
  isLoading = false,
}: DoutorKittyDashboardProps) {
  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Doutora Kitty está analisando seu perfil... 🧐</p>
      </div>
    );
  }

  if (!interpretation) {
    return (
      <div className={styles.loading}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🩺</div>
        <p>Doutora Kitty ainda não tem dados suficientes...</p>
        <p style={{ fontSize: "13px", color: "rgba(153, 153, 153, 0.7)", marginTop: "8px" }}>
          Dá alguns feedbacks em minhas respostas pra eu entender você melhor! 💚
        </p>
      </div>
    );
  }

  const {
    profile,
    summary,
    strengths,
    suggestions,
    preferenceInsights,
    feedbackStats,
  } = interpretation;

  const confidencePercentage = Math.round(profile.confidenceScore * 100);

  return (
    <div className={styles.dashboard}>
      {/* Header com Doutora Kitty */}
      <div className={styles.header}>
        <div className={styles.characterSection}>
          <div className={styles.characterAvatar}>
            <Image
              src="/kitty-avatar.jpg"
              alt="Foto da Doutora Kitty"
              width={88}
              height={88}
              className={styles.characterPhoto}
              priority
            />
          </div>
          <div className={styles.characterInfo}>
            <h1>Doutora Kitty 🩺</h1>
            <p className={styles.subtitle}>Analista de Personalidade Digital</p>
          </div>
        </div>
        <div className={styles.summaryBox}>
          <p>{summary}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon + " " + styles.like}>
            <Heart size={28} fill="currentColor" />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{Math.max(feedbackStats.totalLikes || 0, 0)}</div>
            <div className={styles.statLabel}>Cuki 💚</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon + " " + styles.dislike}>
            <MessageCircle size={28} fill="currentColor" />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{Math.max(feedbackStats.totalDislikes || feedbackStats.totalFeedback - feedbackStats.totalLikes || 0, 0)}</div>
            <div className={styles.statLabel}>Poderia Melhorar 🤔</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon + " " + styles.percentage}>
            <TrendingUp size={28} />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{Math.round(feedbackStats.likePercentage || 0)}%</div>
            <div className={styles.statLabel}>Satisfação</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon + " " + styles.confidence}>
            <AlertCircle size={24} />
          </div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{confidencePercentage}%</div>
            <div className={styles.statLabel}>Confiança de Análise</div>
          </div>
        </div>
      </div>

      {/* Psychological Profile */}
      <div className={styles.sectionBox}>
        <h2 className={styles.sectionTitle}>🧠 Seu Perfil Psicológico</h2>
        <div className={styles.preferencesGrid}>
          {Object.entries(preferenceInsights).map(([key, insight]) => (
            <div key={key} className={styles.preferenceCard}>
              <p>{insight as string}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tendência e Insights */}
      <div className={styles.insightsRow}>
        <div className={styles.insightBox}>
          <h3>📈 Tendência Recente</h3>
          <div
            className={`${styles.trendBadge} ${styles[feedbackStats.recentTrend]}`}
          >
            {feedbackStats.recentTrend === "improving"
              ? "🚀 Melhorando!"
              : feedbackStats.recentTrend === "stable"
                ? "⚖️ Estável"
                : "📉 Precisa melhorar"}
          </div>
        </div>

        <div className={styles.insightBox}>
          <h3>🎯 Consistência</h3>
          <div className={styles.consistencyBar}>
            <div
              className={styles.consistencyFill}
              style={{
                width: `${Math.round(feedbackStats.consistencyScore * 100)}%`,
              }}
            />
          </div>
          <p className={styles.consistencyLabel}>
            {feedbackStats.consistencyScore > 0.7
              ? "Muito consistente"
              : feedbackStats.consistencyScore > 0.4
                ? "Moderadamente consistente"
                : "Variado"}
          </p>
        </div>
      </div>

      {/* Strengths */}
      {strengths && strengths.length > 0 && (
        <div className={styles.sectionBox}>
          <h2 className={styles.sectionTitle}>⭐ Seus Pontos Fortes</h2>
          <ul className={styles.list}>
            {strengths.map((strength: string, idx: number) => (
              <li key={idx}>{strength}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <div className={styles.sectionBox + " " + styles.suggestionBox}>
          <h2 className={styles.sectionTitle}>💡 Dicas da Doutora Kitty</h2>
          <ul className={styles.suggestionList}>
            {suggestions.map((suggestion: string, idx: number) => (
              <li key={idx} className={styles.suggestionItem}>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer Message */}
      <div className={styles.footer}>
        <p>
          Feito com 💚 pela Doutora Kitty - Sua psicóloga digital favorita!
        </p>
        <p className={styles.footerSub}>
          Quanto mais você feedback, mais eu entendo você! 🧬
        </p>
      </div>
    </div>
  );
}
