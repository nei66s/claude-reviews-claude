"use client";

const RUNNER_PHRASES = [
  "To ino ve isso agora",
  "To correndo pra Betinha naum briga",
  "Pêra vuxê... pobi do Chokito",
  "Euuu.. ja volto!",
  "Tô ficano canxado",
  "Perai q to ino",
  "Vou ver o que o vuxê quer pobi"
];

export default function RunnerOverlay({ active = false }) {
  const phrase = RUNNER_PHRASES[0];

  if (!active) return null;

  return (
    <div className={`runner-overlay active`}>
      <div className="runner-oval">
        <video
          src="/runner-loop.mp4"
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
        />
      </div>
      <div className="runner-text">{phrase}</div>
      <div className="runner-progress-wrap">
        <div className="runner-progress-bar"></div>
      </div>
    </div>
  );
}
