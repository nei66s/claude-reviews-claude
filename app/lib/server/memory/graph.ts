import crypto from "node:crypto";

import type { SessionUser } from "@/lib/server/auth";
import type { UserMemoryItem, UserProfile } from "@/lib/server/memory/types";
import { getUserProfile, listUserMemoryItemsByUserId } from "@/lib/server/memory/repository";

export type MemoryGraphNodeKind =
  | "root"
  | "group"
  | "user"
  | "section"
  | "trait"
  | "memory_item";

export type MemoryGraphNode = {
  id: string;
  label: string;
  kind: MemoryGraphNodeKind;
  userId?: string;
  source?: "user_profile" | "user_memory_items" | "system";
  payload?: Record<string, unknown>;
};

export type MemoryGraphEdge = {
  id: string;
  source: string;
  target: string;
  kind?: "contains" | "references";
  label?: string;
};

export type MemoryGraphResponse = {
  meta: {
    userId: string;
    generatedAt: string;
    profileUpdatedAt: string | null;
    memoryItemsTotal: number;
    memoryItemsIncluded: number;
  };
  nodes: MemoryGraphNode[];
  edges: MemoryGraphEdge[];
};

function sha1Short(input: string) {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 10);
}

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeStrings(values: unknown, limit: number) {
  const arr = Array.isArray(values) ? values : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of arr) {
    const text = toText(raw);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function extractLikelyName(profile: UserProfile | null, items: UserMemoryItem[], fallback?: string) {
  const fromKeyFacts = normalizeStrings(profile?.keyFacts ?? [], 30);
  const candidates = [
    ...fromKeyFacts,
    ...items
      .filter((item) => item.type === "declared_fact" || item.type === "inferred_trait")
      .slice(0, 80)
      .map((item) => item.content),
  ];

  for (const fact of candidates) {
    const match = /^nome\s*:\s*(.+)$/i.exec(String(fact).trim());
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return fallback;
}

function addNode(
  nodes: MemoryGraphNode[],
  seen: Set<string>,
  node: MemoryGraphNode,
) {
  if (seen.has(node.id)) return;
  seen.add(node.id);
  nodes.push(node);
}

function addEdge(
  edges: MemoryGraphEdge[],
  seen: Set<string>,
  edge: Omit<MemoryGraphEdge, "id">,
) {
  const id = `${edge.source}::${edge.target}::${edge.kind ?? "contains"}::${edge.label ?? ""}`;
  if (seen.has(id)) return;
  seen.add(id);
  edges.push({ id, ...edge });
}

function pickMemoryItemsForGraph(items: UserMemoryItem[]) {
  const allowed = items.filter(
    (item) => item.status === "active" && item.sensitivityLevel !== "high" && item.sensitivityLevel !== "blocked",
  );

  const sorted = [...allowed].sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    if (b.confidenceScore !== a.confidenceScore) return b.confidenceScore - a.confidenceScore;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const buckets: Record<"identity" | "preferences" | "goals" | "topics", UserMemoryItem[]> = {
    identity: [],
    preferences: [],
    goals: [],
    topics: [],
  };

  for (const item of sorted) {
    if (item.type === "goal") buckets.goals.push(item);
    else if (item.type === "preference" || item.type === "interaction_style") buckets.preferences.push(item);
    else buckets.identity.push(item);
  }

  // Mantém o grafo legível: limita por seção e total.
  const MAX_PER_SECTION = 12;
  const MAX_TOTAL = 40;

  const picked: UserMemoryItem[] = [];
  for (const section of ["identity", "preferences", "goals"] as const) {
    picked.push(...buckets[section].slice(0, MAX_PER_SECTION));
  }

  // Se ainda tiver pouco, adiciona mais dos buckets mais cheios (respeitando MAX_TOTAL).
  const remaining = sorted.filter((i) => !picked.some((p) => p.id === i.id));
  picked.push(...remaining.slice(0, Math.max(0, MAX_TOTAL - picked.length)));

  return {
    allowedTotal: allowed.length,
    picked,
  };
}

export async function buildUserMemoryGraph(
  userId: string,
  opts: { viewer?: SessionUser | null } = {},
): Promise<MemoryGraphResponse> {
  const profile = await getUserProfile(userId).catch(() => null);
  const items = await listUserMemoryItemsByUserId(userId, { status: "active", limit: 500 });
  const selection = pickMemoryItemsForGraph(items);

  const nodes: MemoryGraphNode[] = [];
  const edges: MemoryGraphEdge[] = [];
  const nodeSeen = new Set<string>();
  const edgeSeen = new Set<string>();

  const orchestratorNodeId = "memory-orchestrator";
  const usersRootNodeId = "users-root";
  const userNodeId = `user-${userId}`;

  const identityNodeId = `user-${userId}-identity`;
  const preferencesNodeId = `user-${userId}-preferences`;
  const goalsNodeId = `user-${userId}-goals`;
  const topicsNodeId = `user-${userId}-topics`;

  addNode(nodes, nodeSeen, {
    id: orchestratorNodeId,
    label: "Memory Orchestrator",
    kind: "root",
    source: "system",
  });

  addNode(nodes, nodeSeen, {
    id: usersRootNodeId,
    label: "Usuários",
    kind: "group",
    source: "system",
  });

  const viewerName = opts.viewer?.id === userId ? opts.viewer?.displayName : undefined;
  const profileName = extractLikelyName(profile, selection.picked, viewerName);
  const userLabel = profileName ? `${profileName} / ${userId}` : userId;

  addNode(nodes, nodeSeen, {
    id: userNodeId,
    label: userLabel,
    kind: "user",
    userId,
    source: "system",
    payload: {
      profileUpdatedAt: profile?.updatedAt ?? null,
      summaryShort: profile?.summaryShort ?? "",
    },
  });

  addNode(nodes, nodeSeen, {
    id: identityNodeId,
    label: "Identidade",
    kind: "section",
    userId,
    source: "system",
  });
  addNode(nodes, nodeSeen, {
    id: preferencesNodeId,
    label: "Preferências",
    kind: "section",
    userId,
    source: "system",
  });
  addNode(nodes, nodeSeen, {
    id: goalsNodeId,
    label: "Objetivos",
    kind: "section",
    userId,
    source: "system",
  });
  addNode(nodes, nodeSeen, {
    id: topicsNodeId,
    label: "Temas recorrentes",
    kind: "section",
    userId,
    source: "system",
  });

  addEdge(edges, edgeSeen, { source: orchestratorNodeId, target: usersRootNodeId, kind: "contains" });
  addEdge(edges, edgeSeen, { source: usersRootNodeId, target: userNodeId, kind: "contains" });
  addEdge(edges, edgeSeen, { source: userNodeId, target: identityNodeId, kind: "contains" });
  addEdge(edges, edgeSeen, { source: userNodeId, target: preferencesNodeId, kind: "contains" });
  addEdge(edges, edgeSeen, { source: userNodeId, target: goalsNodeId, kind: "contains" });
  addEdge(edges, edgeSeen, { source: userNodeId, target: topicsNodeId, kind: "contains" });

  const identityTraits = [
    ...(profile?.summaryShort ? [`Resumo: ${profile.summaryShort}`] : []),
    ...normalizeStrings(profile?.keyFacts ?? [], 12),
    ...(profileName ? [`Nome: ${profileName}`] : []),
  ];
  const goalsTraits = normalizeStrings(profile?.activeGoals ?? [], 12);
  const topicsTraits = normalizeStrings(profile?.recurringTopics ?? [], 12);

  const interactionPreferences = (profile?.interactionPreferences ?? {}) as Record<string, unknown>;
  const styleTraits = normalizeStrings(interactionPreferences.interaction_style, 8);
  const prefTraits = normalizeStrings(interactionPreferences.preferences, 12);
  const preferencesTraits = [
    ...styleTraits.map((v) => `Estilo: ${v}`),
    ...prefTraits.map((v) => `Preferência: ${v}`),
  ].slice(0, 16);

  function attachTraits(sectionNodeId: string, values: string[], sourceKey: string) {
    for (const value of values) {
      const trimmed = value.trim();
      if (!trimmed) continue;
      const traitId = `user-${userId}-trait-${sha1Short(`${sourceKey}:${trimmed}`)}`;
      addNode(nodes, nodeSeen, {
        id: traitId,
        label: trimmed,
        kind: "trait",
        userId,
        source: "user_profile",
        payload: {
          sourceKey,
          value: trimmed,
        },
      });
      addEdge(edges, edgeSeen, { source: sectionNodeId, target: traitId, kind: "contains" });
    }
  }

  attachTraits(identityNodeId, identityTraits, "user_profile.identity");
  attachTraits(preferencesNodeId, preferencesTraits, "user_profile.preferences");
  attachTraits(goalsNodeId, goalsTraits, "user_profile.activeGoals");
  attachTraits(topicsNodeId, topicsTraits, "user_profile.recurringTopics");

  function attachMemoryItems(sectionNodeId: string, sectionKey: string, sectionItems: UserMemoryItem[]) {
    for (const item of sectionItems) {
      const label = item.content.trim().slice(0, 120) || "(vazio)";
      const itemNodeId = `user-${userId}-memory-${sha1Short(`${sectionKey}:${item.id}`)}`;
      addNode(nodes, nodeSeen, {
        id: itemNodeId,
        label,
        kind: "memory_item",
        userId,
        source: "user_memory_items",
        payload: {
          memoryItemId: item.id,
          type: item.type,
          category: item.category,
          status: item.status,
          sensitivityLevel: item.sensitivityLevel,
          confidenceScore: item.confidenceScore,
          relevanceScore: item.relevanceScore,
          updatedAt: item.updatedAt,
        },
      });
      addEdge(edges, edgeSeen, { source: sectionNodeId, target: itemNodeId, kind: "contains" });
    }
  }

  const bucketed: Record<"identity" | "preferences" | "goals", UserMemoryItem[]> = {
    identity: [],
    preferences: [],
    goals: [],
  };
  for (const item of selection.picked) {
    if (item.type === "goal") bucketed.goals.push(item);
    else if (item.type === "preference" || item.type === "interaction_style") bucketed.preferences.push(item);
    else bucketed.identity.push(item);
  }

  attachMemoryItems(identityNodeId, "identity", bucketed.identity.slice(0, 14));
  attachMemoryItems(preferencesNodeId, "preferences", bucketed.preferences.slice(0, 14));
  attachMemoryItems(goalsNodeId, "goals", bucketed.goals.slice(0, 14));

  return {
    meta: {
      userId,
      generatedAt: new Date().toISOString(),
      profileUpdatedAt: profile?.updatedAt ?? null,
      memoryItemsTotal: selection.allowedTotal,
      memoryItemsIncluded: selection.picked.length,
    },
    nodes,
    edges,
  };
}

