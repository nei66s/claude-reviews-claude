"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "./ChubakaHungerBar.module.css";

interface ChubakaHungerBarProps {
  hungerLevel: number;
  onFeed?: () => void;
  compact?: boolean;
  isSleeping?: boolean;
  onSleep?: () => void;
  onWakeUp?: () => void;
}

export default function ChubakaHungerBar({ 
  hungerLevel, 
  onFeed, 
  compact = false,
  isSleeping = false,
  onSleep,
  onWakeUp
}: ChubakaHungerBarProps) {
  const [displayLevel, setDisplayLevel] = useState(0);
  const [isFeeding, setIsFeeding] = useState(false);

  // Smooth animation da barra
  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayLevel(hungerLevel);
    }, 50);

    return () => clearTimeout(timer);
  }, [hungerLevel]);

  const handleFeed = () => {
    if (isFeeding) return;

    setIsFeeding(true);
    onFeed?.();

    setTimeout(() => {
      setIsFeeding(false);
    }, 600);
  };

  const handleSleepToggle = () => {
    if (isSleeping) {
      onWakeUp?.();
    } else {
      onSleep?.();
    }
  };

  const isCritical = hungerLevel >= 85;
  const barFillClass = isCritical ? `${styles.barFill} ${styles.critical}` : styles.barFill;
  const cardClass = isCritical 
    ? `${styles.card} ${styles.cardCritical} ${compact ? styles.integrated : ""}`
    : `${styles.card} ${compact ? styles.integrated : ""}`;

  return (
    <div className={`${styles.container} ${compact ? styles.containerCompact : ""}`}>
      <div className={cardClass}>
        {/* Imagem do Chubaka */}
        <div className={`${styles.imageWrapper} ${isSleeping ? styles.imageSleeping : ""}`}>
          <Image
            src="/chuba-rosto.png"
            alt="Chuba"
            width={64}
            height={64}
            className={styles.chubakaImage}
          />
          {isSleeping && <div className={styles.sleepingOverlay}>💤</div>}
        </div>

        {/* Informações e barra */}
        <div className={styles.content}>
          <div className={styles.label}>
            <span className={styles.name}>{isSleeping ? "Dormindo..." : "Chuba"}</span>
            <span className={`${styles.percent} ${isCritical ? styles.percentCritical : ""}`}>
              {isSleeping ? "😴" : `${displayLevel}%`}
            </span>
          </div>

          {/* Barra de fome */}
          {!isSleeping && (
            <div className={styles.barContainer}>
              <div className={styles.barBackground}>
                <div
                  className={barFillClass}
                  style={{
                    width: `${displayLevel}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Status */}
          <div className={styles.status}>
            {isSleeping ? (
              <span>😴 Que soninho gostoso...</span>
            ) : (
              <>
                {displayLevel < 30 && <span>😊 Saciado</span>}
                {displayLevel >= 30 && displayLevel < 60 && <span>🤔 Um pouco com fome</span>}
                {displayLevel >= 60 && displayLevel < 85 && <span>😕 Com fome</span>}
                {displayLevel >= 85 && <span>😫 MORRENDO DE FOME!</span>}
              </>
            )}
          </div>

          {/* Botões */}
          <div className={styles.buttonGroup}>
            <button
              className={`${styles.feedButton} ${isFeeding ? styles.feeding : ""}`}
              onClick={handleFeed}
              disabled={isFeeding || isSleeping}
              title={isSleeping ? "Chubaka está dormindo" : "Dar um cuki para o Chubaka"}
            >
              🍪 Cuki
            </button>

            <button
              className={`${styles.sleepButton} ${isSleeping ? styles.sleepActive : ""}`}
              onClick={handleSleepToggle}
              title={isSleeping ? "Acordar Chubaka" : "colocar o chubas para dormir"}
            >
              {isSleeping ? "👁️" : "😴 Mimir"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
