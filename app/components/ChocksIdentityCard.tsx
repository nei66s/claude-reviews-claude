"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

interface AgentIdentity {
  name: string;
  emoji: string;
  nickname: string;
  relationship: string;
  ageMonths: number;
  description: string;
}

export function ChocksIdentityCard() {
  const [identity, setIdentity] = useState<AgentIdentity | null>(null);
  const [greeting, setGreeting] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIdentity = async () => {
      try {
        const [identityRes, greetingRes] = await Promise.all([
          fetch("/api/agent/identity"),
          fetch("/api/agent/greeting"),
        ]);

        if (identityRes.ok) {
          const data = await identityRes.json();
          setIdentity(data.agent);
        }

        if (greetingRes.ok) {
          const data = await greetingRes.json();
          setGreeting(data.greeting);
        }
      } catch (error) {
        console.error("Failed to fetch agent identity:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchIdentity();
  }, []);

  if (loading || !identity) {
    return null;
  }

  return (
    <div className="agent-identity-card">
      <div className="identity-header">
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
          backgroundColor: '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Image
            src="/chocks-avatar-face.jpg"
            alt={identity.name}
            width={56}
            height={56}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '52% 45%' }}
          />
        </div>
        <div className="identity-info">
          <h3 className="agent-name">{identity.name}</h3>
          <p className="agent-description">{identity.description}</p>
        </div>
      </div>

      <div className="identity-details">
        <div className="detail-item">
          <span className="detail-label">Apelido:</span>
          <span className="detail-value">{identity.nickname}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Relacionamento:</span>
          <span className="detail-value">{identity.relationship}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Idade:</span>
          <span className="detail-value">{identity.ageMonths} meses 🐾</span>
        </div>
      </div>

      {greeting && (
        <div className="agent-greeting">
          <p>{greeting}</p>
        </div>
      )}
    </div>
  );
}

export default ChocksIdentityCard;
