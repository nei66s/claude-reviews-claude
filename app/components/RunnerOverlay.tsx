"use client";

import { useEffect, useState } from "react";

const RUNNER_PHRASES = [
  "indo consultar a betinha, segura as pontas ai",
  "indo consultar o pimpim, ja ja eu volto",
];

export default function RunnerOverlay({ active = false }) {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (!active) return;

    const interval = setInterval(() => {
      setPhraseIndex((current) => (current + 1) % RUNNER_PHRASES.length);
    }, 1500);

    return () => clearInterval(interval);
  }, [active]);

  if (!active) return null;

  const phrase = RUNNER_PHRASES[phraseIndex];

  return (
    <div className={`runner-overlay active`}>
      <div className="runner-card">
        <div className="runner-oval">
          <video
            src="/chocks-effort.mp4"
            autoPlay
            loop
            muted
            playsInline
            aria-hidden="true"
          />
        </div>
        <div className="runner-copy">
          <div className="runner-label">Consultando especialista</div>
          <div className="runner-caption">{phrase}</div>
        </div>
      </div>
    </div>
  );
}
