"use client";

import React from "react";
import styles from "./DoutorKittyDashboard.module.css";

interface KittyInterpretation {
  userId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  history: any[];
  profile: {
    tonalPreference: string;
    depthPreference: string;
    structurePreference: string;
    pacePreference: string;
    exampleType: string;
    responseLength: string;
    confidenceScore: number;
    totalFeedback: number;
    likeCount: number;
    dislikeCount: number;
  } | null;
  analysis: {
    patterns: string[];
    tonal: string;
    depth: string;
    structure: string;
    pace: string;
    examples: string;
    length: string;
    suggestions: string[];
    memories: {
      keyFacts: string[];
      summary: string;
      preferences: string[];
    };
  };
}

interface DoutorKittyDashboardProps {
  interpretation: KittyInterpretation | null;
  isLoading: boolean;
}

const translate = (val: string) => {
  const map: Record<string, string> = {
    formal: "Formal",
    casual: "Casual",
    balanced: "Equilibrado",
    simplified: "Simplificado",
    technical: "Técnico",
    narrative: "Narrativo",
    list: "Em listas",
    mixed: "Misto",
    fast: "Rápido",
    detailed: "Detalhado",
    brief: "Breve",
    comprehensive: "Abrangente",
    code: "Focado em Código",
    conceptual: "Conceitual",
  };
  return map[val] || val;
};

const DoutorKittyDashboard: React.FC<DoutorKittyDashboardProps> = ({
  interpretation,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Iniciando análise psicométrica...</p>
      </div>
    );
  }

  if (!interpretation || !interpretation.profile || !interpretation.analysis || interpretation.profile.totalFeedback === 0) {
    return (
      <div className={styles.dashboard}>
        <section className={styles.hero}>
          <div className={styles.avatarCard}>
            <div className={styles.avatarWrapper}>
              <img 
                src="/kitty.jpg" 
                alt="Doutora Kitty" 
                className={styles.avatarImg}
              />
            </div>
            <div className={styles.statLabel}>Aguardando Dados</div>
            <p className={styles.tagline}>Analista Comportamental</p>
          </div>

          <div className={styles.heroContent}>
            <h1>Doutora Kitty 🩺</h1>
            <p className={styles.tagline}>Sua analista de personalidade digital ainda está aprendendo sobre você.</p>
            <p className={styles.summary}>
              Continue conversando com o CHOCKS e avalie as respostas dele clicando em &quot;CUKI&quot; ou &quot;Não curti&quot;. 
              Em breve, eu terei dados suficientes para criar o seu Perfil Psicométrico Profissional aqui!
            </p>
          </div>
        </section>
      </div>
    );
  }

  const { profile, analysis } = interpretation;
  const successRate = profile.totalFeedback > 0 
    ? Math.round((profile.likeCount / profile.totalFeedback) * 100) 
    : 0;

  return (
    <div className={styles.dashboard}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.avatarCard}>
          <div className={styles.avatarWrapper}>
            <img 
              src="/kitty.jpg" 
              alt="Doutora Kitty" 
              className={styles.avatarImg}
            />
          </div>
          <div className={styles.statLabel}>Status Ativo</div>
          <p className={styles.tagline}>Analista Comportamental Senior</p>
        </div>

        <div className={styles.heroContent}>
          <h1>Doutora Kitty</h1>
          <p className={styles.tagline}>Perfil Digital Personalizado</p>
          <div className={styles.summary}>
            <p>
              &quot;Com base em {profile.totalFeedback} interações, identifiquei que você prefere um fluxo de trabalho 
              <strong> {translate(analysis.pace)}</strong> e comunicações com nível <strong>{translate(analysis.tonal)}</strong>. 
              Minha análise indica uma compatibilidade de {successRate}% com o modelo atual.&quot;
            </p>
          </div>
        </div>
      </section>

      {/* Primary Metrics */}
      <section className={styles.statsGrid}>
        <div className={styles.statCard} style={{ animationDelay: "100ms" }}>
          <div className={styles.statLabel}>Interações Positivas</div>
          <div className={styles.statValue}>
            {profile.likeCount} <span>CUKI</span>
          </div>
        </div>
        <div className={styles.statCard} style={{ animationDelay: "200ms" }}>
          <div className={styles.statLabel}>Taxa de Satisfação</div>
          <div className={styles.statValue}>
            {successRate}<span>%</span>
          </div>
        </div>
        <div className={styles.statCard} style={{ animationDelay: "300ms" }}>
          <div className={styles.statLabel}>Confiança da Análise</div>
          <div className={styles.statValue}>
            {Math.round(profile.confidenceScore * 100)}<span>%</span>
          </div>
        </div>
        <div className={styles.statCard} style={{ animationDelay: "400ms" }}>
          <div className={styles.statLabel}>Volume de Feedback</div>
          <div className={styles.statValue}>
            {profile.totalFeedback} <span>Total</span>
          </div>
        </div>
      </section>

      {/* Behavioral Matrix */}
      <section>
        <h2 className={styles.recTitle}>Matriz de Afinidade</h2>
        <div className={styles.matrixSection}>
          <div className={styles.matrixCard} style={{ animationDelay: "500ms" }}>
            <div className={styles.matrixHeader}>
              <span className={styles.matrixTitle}>TOM DA VOZ</span>
              <span className={styles.matrixValue}>{translate(analysis.tonal)}</span>
            </div>
            <p className={styles.matrixDescription}>Adaptando a linguagem para melhor ressonância cognitiva.</p>
          </div>
          <div className={styles.matrixCard} style={{ animationDelay: "600ms" }}>
            <div className={styles.matrixHeader}>
              <span className={styles.matrixTitle}>PROFUNDIDADE</span>
              <span className={styles.matrixValue}>{translate(analysis.depth)}</span>
            </div>
            <p className={styles.matrixDescription}>Equilibrando detalhes técnicos com clareza objetiva.</p>
          </div>
          <div className={styles.matrixCard} style={{ animationDelay: "700ms" }}>
            <div className={styles.matrixHeader}>
              <span className={styles.matrixTitle}>ESTRUTURA</span>
              <span className={styles.matrixValue}>{translate(analysis.structure)}</span>
            </div>
            <p className={styles.matrixDescription}>Organização de dados preferida pelo seu processamento.</p>
          </div>
          <div className={styles.matrixCard} style={{ animationDelay: "800ms" }}>
            <div className={styles.matrixHeader}>
              <span className={styles.matrixTitle}>EXEMPLOS</span>
              <span className={styles.matrixValue}>{translate(analysis.examples)}</span>
            </div>
            <p className={styles.matrixDescription}>Tipologia de exemplos que geram maior entendimento.</p>
          </div>
          
          <div className={styles.matrixCard} style={{ animationDelay: "900ms", gridColumn: "span 2" }}>
            <div className={styles.matrixHeader}>
              <span className={styles.matrixTitle}>MEMÓRIAS E FATOS</span>
              <span className={styles.matrixValue}>{analysis.memories?.keyFacts?.length || 0} Identificados</span>
            </div>
            <div className={styles.matrixDescription} style={{ marginTop: "8px" }}>
              {analysis.memories?.keyFacts && analysis.memories.keyFacts.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "13px", color: "var(--kitty-text-dim)" }}>
                  {analysis.memories.keyFacts.slice(0, 3).map((fact, i) => (
                    <li key={i} style={{ marginBottom: "4px" }}>{fact}</li>
                  ))}
                  {analysis.memories.keyFacts.length > 3 && <li>... e mais {analysis.memories.keyFacts.length - 3} fatos</li>}
                </ul>
              ) : (
                "Ainda estou observando seus padrões para consolidar memórias de longo prazo."
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Insights and Suggestions */}
      <section className={styles.recommendations}>
        <h2 className={styles.recTitle}>Ajustes Recomendados para o CHOCKS</h2>
        <div className={styles.recGrid}>
          {analysis.suggestions.map((suggestion, index) => (
            <div key={index} className={styles.recItem}>
              {suggestion}
            </div>
          ))}
          {analysis.suggestions.length === 0 && (
            <div className={styles.recItem}>
              O perfil ainda está em fase de maturação. Continue interagindo para gerar novos insights.
            </div>
          )}
        </div>
      </section>

      <footer className={styles.footer}>
        <p>&copy; 2026 Pimpotasma Intelligence Systems</p>
        <p className={styles.footerSub}>Powered by Kitty Psychometrics Engine v2.1</p>
      </footer>
    </div>
  );
};

export default DoutorKittyDashboard;
