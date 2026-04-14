"use client";

import { useEffect, useState } from "react";

export interface AgentIdentity {
  name: string;
  emoji: string;
  nickname: string;
  relationship: string;
  ageMonths: number;
  description: string;
}

export function useChocksIdentity() {
  const [identity, setIdentity] = useState<AgentIdentity | null>(null);
  const [greeting, setGreeting] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [identityRes, greetingRes] = await Promise.all([
          fetch("/api/agent/identity"),
          fetch("/api/agent/greeting"),
        ]);

        if (!identityRes.ok) {
          throw new Error("Failed to fetch agent identity");
        }

        const identityData = await identityRes.json();
        setIdentity(identityData.agent);

        if (greetingRes.ok) {
          const greetingData = await greetingRes.json();
          setGreeting(greetingData.greeting);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        console.error("Failed to fetch Chocks identity:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { identity, greeting, loading, error };
}
