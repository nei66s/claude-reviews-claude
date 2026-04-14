'use client';

import { useTheme } from '../lib/useTheme';

interface ChocksDanceVideoProps {
  hasMessages?: boolean;
}

export default function ChocksDanceVideo({ hasMessages = false }: ChocksDanceVideoProps) {
  const { theme, mounted } = useTheme();

  if (!mounted || theme !== 'light' || hasMessages) {
    return null;
  }

  return (
    <div className="chocks-dance-video-container chocks-dance-pulsing">
      <div className="chocks-dance-video-box">
        <video autoPlay loop muted playsInline className="chocks-dance-video">
          <source src="/chocks%20dançando.mp4" type="video/mp4" />
        </video>
      </div>
    </div>
  );
}
