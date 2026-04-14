'use client';

import { useEffect, useState } from 'react';

interface TokenStats {
  used: number;
  available: number;
  percentageUsed: number;
  isWarning: boolean;
  isBlocked: boolean;
}

interface TokenCostPanelProps {
  userId: string;
  chatId: string;
}

export default function TokenCostPanel({ userId, chatId }: TokenCostPanelProps) {
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const tokenRes = await fetch(`/api/tokens/stats/${userId}/${chatId}`);
        if (!tokenRes.ok) throw new Error('Failed to fetch token stats');
        const tokenData = await tokenRes.json();
        setTokenStats(tokenData.tokens);
      } catch (err) {
        console.error('Error fetching token stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [userId, chatId]);

  if (isLoading || !tokenStats) {
    return null;
  }

  const getStatusColor = () => {
    if (tokenStats.isBlocked) return 'blocked';
    if (tokenStats.isWarning) return 'warning';
    return 'normal';
  };

  const statusColor = getStatusColor();
  const percentage = tokenStats.percentageUsed;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`token-doughnut token-doughnut-${statusColor}`}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} className="token-doughnut-bg" />
        <circle 
          cx="50" 
          cy="50" 
          r={radius} 
          className="token-doughnut-fill"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: strokeDashoffset,
          }}
        />
      </svg>
      <div className="token-doughnut-label">
        <span className="token-doughnut-pct">{percentage}%</span>
        <span className="token-doughnut-text">Tokens</span>
      </div>
    </div>
  );
}
