"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
  type ReactElement,
} from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../lib/auth";
import { requestJson } from "../lib/api";
import type { ForceGraphMethods, ForceGraphProps } from "react-force-graph-2d";

type GraphNode = {
  id: string;
  label: string;
  kind: "root" | "group" | "user" | "section" | "trait" | "memory_item";
  userId?: string;
  source?: "user_profile" | "user_memory_items" | "system";
  payload?: Record<string, unknown>;
  x?: number;
  y?: number;
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  kind?: "contains" | "references";
  label?: string;
};

type GraphResponse = {
  meta: {
    userId: string;
    generatedAt: string;
    profileUpdatedAt: string | null;
    memoryItemsTotal: number;
    memoryItemsIncluded: number;
  };
  nodes: GraphNode[];
  edges: GraphEdge[];
};

type UserProfileResponse = {
  userId: string;
  profile: {
    userId: string;
    summaryShort: string;
    summaryLong: string;
    interactionPreferences: Record<string, unknown>;
    recurringTopics: unknown[];
    activeGoals: unknown[];
    knownConstraints: unknown[];
    keyFacts: unknown[];
    profileVersion: number;
    lastCompiledAt: string | null;
    updatedAt: string;
  } | null;
};

type UserMemoryItem = {
  id: string;
  userId: string;
  type: string;
  category: string;
  content: string;
  normalizedValue: string;
  sourceConversationId: string;
  sourceMessageId: number | null;
  confidenceScore: number;
  relevanceScore: number;
  sensitivityLevel: string;
  status: string;
  validFrom: string | null;
  validUntil: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type UserItemsResponse = {
  userId: string;
  items: UserMemoryItem[];
};

type MemoryAuditSummary = {
  userId: string;
  firstEventAt: string | null;
  automaticCaptures: number;
  manualCorrections: number;
  archived: number;
  contradicted: number;
  deleted: number;
};

type MemoryAuditResponse = {
  userId: string;
  summary: MemoryAuditSummary;
  events: unknown[];
};

type GraphLink = {
  source: string | GraphNode;
  target: string | GraphNode;
  kind?: GraphEdge["kind"];
  label?: string;
};

const ForceGraph2D = dynamic(
  () => import("react-force-graph-2d").then((mod) => mod.default),
  { ssr: false },
) as unknown as <NodeType = GraphNode, LinkType = GraphLink>(
  props: ForceGraphProps<NodeType, LinkType> & {
    ref?: MutableRefObject<ForceGraphMethods<NodeType, LinkType> | undefined>;
  },
) => ReactElement;

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("pt-BR");
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function pickNodeColor(kind: GraphNode["kind"]) {
  switch (kind) {
    case "root":
      return "#2563EB";
    case "group":
      return "#0F766E";
    case "user":
      return "#7C3AED";
    case "section":
      return "#0F172A";
    case "trait":
      return "#334155";
    case "memory_item":
      return "#EA580C";
    default:
      return "#111827";
  }
}

function pickNodeRadius(kind: GraphNode["kind"]) {
  switch (kind) {
    case "root":
      return 12;
    case "group":
      return 11;
    case "user":
      return 11;
    case "section":
      return 10;
    case "trait":
      return 5.2;
    case "memory_item":
      return 5.4;
    default:
      return 6;
  }
}

function pickShortLabel(node: GraphNode) {
  if (node.kind === "root" || node.kind === "group" || node.kind === "user" || node.kind === "section") {
    return node.label;
  }

  if (node.kind === "memory_item") {
    const type = String(node.payload?.type ?? "").trim();
    switch (type) {
      case "goal":
        return "Objetivo";
      case "preference":
        return "Preferência";
      case "interaction_style":
        return "Estilo";
      case "constraint":
        return "Restrição";
      case "declared_fact":
        return "Fato";
      case "inferred_trait":
        return "Traço";
      default:
        return "Item";
    }
  }

  const sourceKey = String(node.payload?.sourceKey ?? "").trim();
  const value = String(node.payload?.value ?? "").trim();

  if (sourceKey.includes("activeGoals")) return "Objetivo";
  if (sourceKey.includes("recurringTopics")) return "Tema";
  if (sourceKey.includes("preferences")) {
    if (/^estilo\s*:/i.test(value)) return "Estilo";
    return "Preferência";
  }
  if (sourceKey.includes("identity")) {
    if (/^resumo\s*:/i.test(value)) return "Resumo";
    if (/^nome\s*:/i.test(value)) return "Nome";
    if (/^restri(c|ç)ão\s*:/i.test(value)) return "Restrição";
    return "Fato";
  }

  return "Traço";
}

function getLinkEndpointId(endpoint: GraphLink["source"] | GraphLink["target"]) {
  if (typeof endpoint === "string") return endpoint;
  return endpoint?.id ?? "";
}

function uniqNonEmpty(values: string[], limit: number) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const v = String(raw ?? "").trim();
    if (!v) continue;
    const key = normalizeText(v);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

function extractNameFromText(lines: string[]) {
  for (const line of lines) {
    const match = /^nome\s*:\s*(.+)$/i.exec(String(line).trim());
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function formatMaybeNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? String(n) : "-";
}

function itemTypeLabel(type: string) {
  switch (type) {
    case "declared_fact":
      return "Fato";
    case "inferred_trait":
      return "Traço";
    case "constraint":
      return "Restrição";
    case "preference":
      return "Preferência";
    case "interaction_style":
      return "Estilo";
    case "goal":
      return "Objetivo";
    default:
      return type || "Item";
  }
}

type D3NodeLike = {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
};

type CentripetalForce = ((alpha: number) => void) & {
  initialize?: (nodes: D3NodeLike[]) => void;
  setStrength?: (value: number) => void;
};

function createCentripetalForce(initialStrength: number): CentripetalForce {
  let nodes: D3NodeLike[] = [];
  let strength = initialStrength;

  const force = ((alpha: number) => {
    for (const node of nodes) {
      const x = typeof node.x === "number" ? node.x : 0;
      const y = typeof node.y === "number" ? node.y : 0;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const vx = typeof node.vx === "number" ? node.vx : 0;
      const vy = typeof node.vy === "number" ? node.vy : 0;
      node.vx = vx + -x * strength * alpha;
      node.vy = vy + -y * strength * alpha;
    }
  }) as CentripetalForce;

  force.initialize = (ns) => {
    nodes = ns;
  };
  force.setStrength = (value) => {
    strength = value;
  };

  return force;
}

export default function MemoryGraphView() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [targetUserId, setTargetUserId] = useState("");
  const [userList, setUserList] = useState<string[]>([]);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfileResponse["profile"] | null>(null);
  const [items, setItems] = useState<UserMemoryItem[]>([]);
  const [auditSummary, setAuditSummary] = useState<MemoryAuditSummary | null>(null);
  const [showDetails, setShowDetails] = useState(true);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());

  const canInspectOtherUsers = user?.id === "local-admin";

  const fgRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);

  const [forces, setForces] = useState(() => ({
    centripetal: 0.02,
    repulsion: -180,
    linkStrength: 1.0,
    linkDistance: 150,
  }));

  const [layoutMode, setLayoutMode] = useState<"fixed" | "forces">("forces");
  const [dragEnabled, setDragEnabled] = useState(false);
  const [lockOnDrag, setLockOnDrag] = useState(true);

  const centripetalForceRef = useRef<CentripetalForce | null>(null);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    if (!centripetalForceRef.current) {
      centripetalForceRef.current = createCentripetalForce(forces.centripetal);
    } else {
      centripetalForceRef.current.setStrength?.(forces.centripetal);
    }
    fg.d3Force("centripetal", centripetalForceRef.current as unknown as (alpha: number) => void);

    const charge = fg.d3Force("charge") as unknown as { strength?: (value: number) => unknown } | undefined;
    charge?.strength?.(forces.repulsion);

    const link = fg.d3Force("link") as unknown as
      | { strength?: (value: number) => unknown; distance?: (value: number) => unknown }
      | undefined;
    link?.strength?.(forces.linkStrength);
    link?.distance?.(forces.linkDistance);

    if (layoutMode === "forces") {
      fg.d3ReheatSimulation();
    }
  }, [forces, layoutMode]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user && !targetUserId) {
      setTargetUserId(user.id);
    }
    
    const fetchUsers = async () => {
      try {
        const resp = await requestJson("/memory/users");
        if (Array.isArray(resp?.users)) setUserList(resp.users);
      } catch (e) {
        console.error("Failed to fetch users list", e);
      }
    };
    fetchUsers();
  }, [user, isLoading, router, targetUserId]);

  const structuralGraph = useMemo(() => {
    if (!graph) return null;

    const keepKinds = new Set<GraphNode["kind"]>(["root", "group", "user", "section"]);
    const keepNodeId = new Set<string>();
    for (const node of graph.nodes) {
      if (keepKinds.has(node.kind)) keepNodeId.add(node.id);
    }

    const nodes = graph.nodes.filter((n) => keepNodeId.has(n.id));
    const edges = graph.edges.filter((e) => keepNodeId.has(e.source) && keepNodeId.has(e.target));
    return { ...graph, nodes, edges };
  }, [graph]);

  const [canvasNodes, setCanvasNodes] = useState<GraphNode[]>([]);
  const [canvasLinks, setCanvasLinks] = useState<GraphLink[]>([]);

  useEffect(() => {
    if (!structuralGraph) {
      setCanvasNodes([]);
      setCanvasLinks([]);
      return;
    }

    // Filter nodes and links based on collapsed state
    const visibleNodeIds = new Set<string>();
    const stack = ["memory-orchestrator"]; // Start from root
    
    // Map of parent -> children for traversal
    const childrenMap = new Map<string, string[]>();
    for (const edge of structuralGraph.edges) {
      const list = childrenMap.get(edge.source) || [];
      list.push(edge.target);
      childrenMap.set(edge.source, list);
    }

    while (stack.length > 0) {
      const currId = stack.pop()!;
      visibleNodeIds.add(currId);
      
      if (!collapsedNodeIds.has(currId)) {
        const children = childrenMap.get(currId) || [];
        for (const childId of children) {
          if (!visibleNodeIds.has(childId)) {
            stack.push(childId);
          }
        }
      }
    }

    setCanvasNodes(structuralGraph.nodes.filter(n => visibleNodeIds.has(n.id)).map((n) => ({ ...n })));
    setCanvasLinks(
      structuralGraph.edges
        .filter(edge => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
        .map((edge) => ({
          source: edge.source,
          target: edge.target,
          kind: edge.kind,
          label: edge.label,
        }))
    );
  }, [structuralGraph, collapsedNodeIds]);

  const topicStrength = useMemo(() => {
    const recurringTopics = Array.isArray(profile?.recurringTopics)
      ? (profile?.recurringTopics ?? []).map((v) => String(v)).filter((v) => String(v || "").trim())
      : [];
    return recurringTopics.length;
  }, [profile]);

  const topicsNodeId = useMemo(() => {
    const userId = graph?.meta.userId;
    return userId ? `user-${userId}-topics` : null;
  }, [graph]);

  const applyFixedLayout = () => {
    if (!graph) return;
    const userId = graph.meta.userId;
    const id = {
      orchestrator: "memory-orchestrator",
      users: "users-root",
      user: `user-${userId}`,
      identity: `user-${userId}-identity`,
      preferences: `user-${userId}-preferences`,
      goals: `user-${userId}-goals`,
      topics: `user-${userId}-topics`,
    };

    const anchor = {
      orchestrator: { x: 0, y: -340 },
      users: { x: 0, y: -220 },
      user: { x: 0, y: -20 },
      goals: { x: 0, y: -280 },
      topics: { x: 0, y: 240 },
      identity: { x: 290, y: -20 },
      preferences: { x: -290, y: -20 },
    };

    for (const node of canvasNodes) {
      const mutable = node as unknown as { fx?: number; fy?: number; x?: number; y?: number };
      const pos =
        node.id === id.orchestrator
          ? anchor.orchestrator
          : node.id === id.users
            ? anchor.users
            : node.id === id.user
              ? anchor.user
              : node.id === id.goals
                ? anchor.goals
                : node.id === id.topics
                  ? anchor.topics
                  : node.id === id.identity
                    ? anchor.identity
                    : node.id === id.preferences
                      ? anchor.preferences
                      : null;

      if (pos) {
        mutable.fx = pos.x;
        mutable.fy = pos.y;
        mutable.x = pos.x;
        mutable.y = pos.y;
      }
    }

    fgRef.current?.d3ReheatSimulation();
  };

  const clearNodeLocks = () => {
    for (const node of canvasNodes) {
      delete (node as unknown as { fx?: number; fy?: number }).fx;
      delete (node as unknown as { fx?: number; fy?: number }).fy;
    }
    fgRef.current?.d3ReheatSimulation();
  };

  useEffect(() => {
    if (!structuralGraph) return;
    if (layoutMode === "fixed") {
      applyFixedLayout();
      return;
    }
    clearNodeLocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutMode, structuralGraph?.nodes?.length]);

  const nodeById = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const node of canvasNodes) map.set(node.id, node);
    return map;
  }, [canvasNodes]);

  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) ?? null : null;

  const graphData = useMemo(() => {
    return { nodes: canvasNodes, links: canvasLinks };
  }, [canvasNodes, canvasLinks]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 900, height: 640 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setSize({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(320, Math.floor(rect.height)),
      });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const loadGraph = async () => {
    const userId = targetUserId.trim();
    if (!userId) {
      setError("Informe um userId.");
      return;
    }
    if (!canInspectOtherUsers && user && userId !== user.id) {
      setError("Você não tem permissão para visualizar outro usuário.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = (await requestJson(`/memory/users/${encodeURIComponent(userId)}/graph`)) as GraphResponse;
      setGraph(data);
      setSelectedNodeId("memory-orchestrator");
      setHoverNodeId(null);

      // Enriquecimento read-only do painel lateral (mesma fonte: endpoints internos existentes).
      const [profileRes, itemsRes] = await Promise.all([
        requestJson(`/memory/users/${encodeURIComponent(userId)}/profile`).catch(() => null),
        requestJson(`/memory/users/${encodeURIComponent(userId)}/items?status=active&limit=200`).catch(() => null),
      ]);
      const parsedProfile = (profileRes as UserProfileResponse | null)?.profile ?? null;
      const parsedItems = ((itemsRes as UserItemsResponse | null)?.items ?? []).filter(Boolean);
      setProfile(parsedProfile);
      setItems(parsedItems);

      const auditRes = (await requestJson(`/memory/users/${encodeURIComponent(userId)}/audit?limit=1`).catch(() => null)) as
        | MemoryAuditResponse
        | null;
      setAuditSummary(auditRes?.summary ?? null);
    } catch (e) {
      setGraph(null);
      setSelectedNodeId(null);
      setHoverNodeId(null);
      setProfile(null);
      setItems([]);
      setAuditSummary(null);
      setError(e instanceof Error ? e.message : "Falha ao carregar o grafo.");
    } finally {
      setLoading(false);
    }
  };

  const zoomToFit = () => {
    fgRef.current?.zoomToFit?.(400, 32);
  };

  // Auto-load graph on focus/mount if we have a userId
  useEffect(() => {
    if (user && targetUserId && !loading && !error) {
      void loadGraph();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, targetUserId]);

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    borderBottom: "1px solid var(--line)",
    background: "var(--panel)",
    backdropFilter: "blur(10px)",
    position: "sticky",
    top: 0,
    zIndex: 10,
    color: "var(--text)",
  };

  const inputStyle: CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--line)",
    background: "var(--panel-soft)",
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
    minWidth: 240,
  };

  const buttonStyle: CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--line)",
    background: "var(--panel-soft)",
    color: "var(--text)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  };

  return (
    <div
      className="view"
      style={{ overflow: "hidden", background: "var(--bg)", color: "var(--text)", display: "flex", flexDirection: "column" }}
    >
      <div style={headerStyle}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14 }}>Memory Graph (read-only)</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Visualização interna do estado atual no banco</div>
            <button
               style={{ ...buttonStyle, padding: '4px 10px', fontSize: 11, background: 'var(--accent-low)' }}
               onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? '⇠ Ocultar Detalhes' : '⇢ Mostrar Detalhes'}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            style={inputStyle}
            value={targetUserId}
            onChange={(e) => {
              setTargetUserId(e.target.value);
              setGraph(null); // Clear old graph to trigger re-load via effect
            }}
            disabled={loading}
          >
            {userList.length === 0 && (
              <option value={targetUserId}>{targetUserId}</option>
            )}
            {userList.map(uid => (
              <option key={uid} value={uid}>
                {uid} {uid === user?.id ? '(você)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: showDetails ? "1fr 360px" : "1fr",
          gap: showDetails ? 12 : 0,
          padding: 12,
          flex: 1,
          minHeight: 0,
        }}
      >
        <div
          ref={containerRef}
          style={{
            height: "100%",
            borderRadius: 14,
            border: "1px solid var(--line)",
            background: "var(--panel)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {structuralGraph ? (
            <>
              <div
                style={{
                  position: "absolute",
                  left: 12,
                  top: 12,
                  zIndex: 5,
                  width: 260,
                  borderRadius: 14,
                  border: "1px solid var(--line)",
                  background: "var(--panel)",
                  backdropFilter: "blur(10px)",
                  padding: 12,
                  boxShadow: "var(--shadow-soft)",
                  color: "var(--text)",
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 12, marginBottom: 10, letterSpacing: 0.2 }}>Layout</div>

                <div style={{ display: "grid", gap: 10, fontSize: 12 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      style={{
                        flex: 1,
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid var(--line)",
                        background: layoutMode === "fixed" ? "var(--accent-soft)" : "var(--panel-soft)",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 800,
                        color: "var(--text)",
                      }}
                      onClick={() => setLayoutMode("fixed")}
                      title="Layout estável e previsível (macroestrutura)"
                    >
                      Fixo
                    </button>
                    <button
                      style={{
                        flex: 1,
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid var(--line)",
                        background: layoutMode === "forces" ? "rgba(139, 92, 246, 0.18)" : "var(--panel-soft)",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 800,
                        color: "var(--text)",
                      }}
                      onClick={() => setLayoutMode("forces")}
                      title="Modo forças (ajustes finos estilo Obsidian)"
                    >
                      Forças
                    </button>
                  </div>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      opacity: 0.95,
                    }}
                  >
                    <span>Arrastar nós</span>
                    <input
                      type="checkbox"
                      style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
                      checked={dragEnabled}
                      onChange={(e) => setDragEnabled(e.target.checked)}
                      aria-label="Habilitar arrastar nós"
                    />
                  </label>

                  <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, opacity: 0.95 }}>
                    <span>Fixar ao arrastar</span>
                    <input
                      type="checkbox"
                      style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
                      checked={lockOnDrag}
                      disabled={!dragEnabled}
                      onChange={(e) => setLockOnDrag(e.target.checked)}
                      aria-label="Fixar nó ao soltar"
                    />
                  </label>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.9 }}>
                      <span>Força centrípeta</span>
                      <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                        {forces.centripetal.toFixed(3)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={0.08}
                      step={0.002}
                      value={forces.centripetal}
                      onChange={(e) => setForces((s) => ({ ...s, centripetal: Number(e.target.value) }))}
                      disabled={layoutMode !== "forces"}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.9 }}>
                      <span>Força de repulsão</span>
                      <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                        {forces.repulsion}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-600}
                      max={-20}
                      step={10}
                      value={forces.repulsion}
                      onChange={(e) => setForces((s) => ({ ...s, repulsion: Number(e.target.value) }))}
                      disabled={layoutMode !== "forces"}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.9 }}>
                      <span>Força dos links</span>
                      <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                        {forces.linkStrength.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={forces.linkStrength}
                      onChange={(e) => setForces((s) => ({ ...s, linkStrength: Number(e.target.value) }))}
                      disabled={layoutMode !== "forces"}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.9 }}>
                      <span>Distância dos links</span>
                      <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                        {forces.linkDistance}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={60}
                      max={260}
                      step={10}
                      value={forces.linkDistance}
                      onChange={(e) => setForces((s) => ({ ...s, linkDistance: Number(e.target.value) }))}
                      disabled={layoutMode !== "forces"}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <button
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid var(--line)",
                      background: "var(--panel-soft)",
                      color: "var(--text)",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                    onClick={() =>
                      setForces({
                        centripetal: 0.02,
                        repulsion: -180,
                        linkStrength: 1.0,
                        linkDistance: 150,
                      })
                    }
                  >
                    Reset forças
                  </button>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      style={{
                        flex: 1,
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid var(--line)",
                        background: "var(--panel-soft)",
                        color: "var(--text)",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                      onClick={() => {
                        if (layoutMode === "fixed") applyFixedLayout();
                        else clearNodeLocks();
                      }}
                      title={layoutMode === "fixed" ? "Reaplica o layout fixo padrão" : "Remove travas (fx/fy) e deixa o layout reorganizar"}
                    >
                      {layoutMode === "fixed" ? "Reset layout" : "Soltar nós"}
                    </button>
                    <button
                      style={{
                        flex: 1,
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid var(--line)",
                        background: "var(--panel-soft)",
                        color: "var(--text)",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                      onClick={zoomToFit}
                      title="Centraliza e ajusta o zoom"
                    >
                      Enquadrar
                    </button>
                  </div>
                </div>
              </div>

              <ForceGraph2D
                ref={fgRef}
                width={size.width}
                height={size.height}
                graphData={graphData}
                nodeId="id"
                backgroundColor="transparent"
                dagMode="radialout"
                dagLevelDistance={forces.linkDistance}
                nodeLabel={() => ""}
                d3VelocityDecay={0.55}
                d3AlphaDecay={0.12}
                enableNodeDrag={dragEnabled}
                linkColor={(link: GraphLink) => {
                  const source = nodeById.get(getLinkEndpointId(link.source));
                  const target = nodeById.get(getLinkEndpointId(link.target));
                  const sourceId = getLinkEndpointId(link.source);
                  const targetId = getLinkEndpointId(link.target);
                  const systemTrunk =
                    (sourceId === "memory-orchestrator" && targetId === "users-root") ||
                    (sourceId === "users-root" && targetId.startsWith("user-"));
                  if (systemTrunk) return "rgba(51, 65, 85, 0.55)";

                  const strong =
                    source?.kind === "user" ||
                    target?.kind === "user" ||
                    source?.kind === "section" ||
                    target?.kind === "section";
                  return strong ? "rgba(71, 85, 105, 0.42)" : "rgba(100, 116, 139, 0.28)";
                }}
                linkWidth={(link: GraphLink) => {
                  const source = nodeById.get(getLinkEndpointId(link.source));
                  const target = nodeById.get(getLinkEndpointId(link.target));
                  if (source?.kind === "root" || target?.kind === "root") return 2;
                  if (source?.kind === "user" || target?.kind === "user") return 1.7;
                  if (source?.kind === "section" || target?.kind === "section") return 1.35;
                  return link.kind === "references" ? 1.1 : 1;
                }}
                cooldownTicks={layoutMode === "fixed" ? 0 : 80}
                onNodeClick={(node: GraphNode, _event: MouseEvent) => {
                  // Single click selects
                  setSelectedNodeId(node.id);
                  
                  // Double click logic simulation (since react-force-graph doesn't have native onNodeDoubleClick in this version)
                  const now = Date.now();
                  const lastClick = (node as unknown as { _lastClick?: number })._lastClick || 0;
                  if (now - lastClick < 300) {
                    // Double click triggered
                    setCollapsedNodeIds(prev => {
                      const next = new Set(prev);
                      if (next.has(node.id)) next.delete(node.id);
                      else next.add(node.id);
                      return next;
                    });
                    (node as unknown as { _lastClick?: number })._lastClick = 0;
                  } else {
                    (node as unknown as { _lastClick?: number })._lastClick = now;
                  }
                }}
                onNodeHover={(node: GraphNode | null) => setHoverNodeId(node?.id ?? null)}
                onNodeDragEnd={(node: GraphNode) => {
                  if (!lockOnDrag) return;
                  const mutable = node as unknown as { fx?: number; fy?: number; x?: number; y?: number };
                  mutable.fx = typeof mutable.x === "number" ? mutable.x : 0;
                  mutable.fy = typeof mutable.y === "number" ? mutable.y : 0;
                }}
                nodeCanvasObject={(node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
                  const isSelected = node.id === selectedNodeId;
                  const isHover = node.id === hoverNodeId;
                  const shortLabel = pickShortLabel(node);
                  const baseColor = pickNodeColor(node.kind);
                  const isSystemCore = node.id === "memory-orchestrator";
                  const isUserCore = node.kind === "user";
                  const isUsersRoot = node.id === "users-root";
                  const isTopics = topicsNodeId && node.id === topicsNodeId;
                  const topicsWeak = Boolean(isTopics && topicStrength < 2);

                  const color = topicsWeak ? "rgba(100,116,139,0.55)" : baseColor;
                  const r =
                    pickNodeRadius(node.kind) *
                    (isSystemCore ? 1.15 : isUserCore ? 1.08 : 1) *
                    (isSelected ? 1.12 : isHover ? 1.06 : 1) *
                    (topicsWeak ? 0.96 : 1);
                  const fontSize = Math.max(11, 14 / globalScale);

                  const x = node.x ?? 0;
                  const y = node.y ?? 0;

                  ctx.beginPath();
                  ctx.arc(x, y, r, 0, 2 * Math.PI, false);
                  ctx.fillStyle = topicsWeak ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.98)";
                  ctx.fill();

                  ctx.lineWidth = isSelected ? 3 : isSystemCore ? 3 : isUserCore ? 2.8 : isUsersRoot ? 2.4 : 2.2;
                  ctx.strokeStyle = color;
                  ctx.stroke();

                  // Visual indicator for collapsed nodes
                  if (collapsedNodeIds.has(node.id)) {
                    ctx.beginPath();
                    ctx.setLineDash([2, 2]);
                    ctx.arc(x, y, r + 4, 0, 2 * Math.PI, false);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.setLineDash([]); // Reset
                  }

                  if (isSystemCore) {
                    ctx.beginPath();
                    ctx.arc(x, y, r + 6, 0, 2 * Math.PI, false);
                    ctx.strokeStyle = "rgba(37,99,235,0.22)";
                    ctx.lineWidth = 2;
                    ctx.stroke();
                  }

                  ctx.font = `${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
                  ctx.textAlign = "left";
                  ctx.textBaseline = "middle";

                  const textX = x + r + 10;
                  const textY = y;
                  const textWidth = ctx.measureText(shortLabel).width;
                  const padX = 6;
                  const padY = 4;

                  ctx.fillStyle = isSelected ? "rgba(255,255,255,0.99)" : "rgba(255,255,255,0.96)";
                  ctx.fillRect(textX - padX, textY - fontSize / 2 - padY, textWidth + padX * 2, fontSize + padY * 2);

                  ctx.strokeStyle = "rgba(15, 23, 42, 0.16)";
                  ctx.lineWidth = 1;
                  ctx.strokeRect(textX - padX, textY - fontSize / 2 - padY, textWidth + padX * 2, fontSize + padY * 2);

                  ctx.fillStyle = topicsWeak ? "rgba(15, 23, 42, 0.65)" : isSelected ? "#0F172A" : "rgba(15, 23, 42, 0.92)";
                  ctx.fillText(shortLabel, textX, textY);
                }}
                nodePointerAreaPaint={(node: GraphNode, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
                  const label = pickShortLabel(node) || node.id;
                  const r = pickNodeRadius(node.kind) + 10;
                  const fontSize = Math.max(10, 12 / globalScale);

                  const x = node.x ?? 0;
                  const y = node.y ?? 0;

                  ctx.fillStyle = color;
                  ctx.beginPath();
                  ctx.arc(x, y, r, 0, 2 * Math.PI, false);
                  ctx.fill();

                  ctx.font = `${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
                  const textWidth = ctx.measureText(label).width;
                  const textX = x + r + 6;
                  const textY = y;
                  ctx.fillRect(textX - 6, textY - fontSize / 2 - 6, textWidth + 12, fontSize + 12);
                }}
              />
            </>
          ) : (
            <div style={{ padding: 16, opacity: 0.75 }}>
              {error ? <div style={{ color: "#DC2626", fontWeight: 700 }}>{error}</div> : <div>Carregue um userId para ver o grafo.</div>}
            </div>
          )}
        </div>

        {showDetails && (
          <div
            style={{
              height: "100%",
              borderRadius: 14,
              border: "1px solid var(--line)",
              background: "var(--panel)",
              padding: 14,
              overflow: "auto",
              color: "var(--text)",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Detalhes</div>
  
            {graph ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
                <div style={{ opacity: 0.8 }}>
                  <div>
                    userId: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>{graph.meta.userId}</span>
                  </div>
                  <div>gerado: {formatDate(graph.meta.generatedAt)}</div>
                  <div>perfil atualizado: {formatDate(graph.meta.profileUpdatedAt)}</div>
                  <div>
                    itens (ativos/ok): {graph.meta.memoryItemsIncluded} / {graph.meta.memoryItemsTotal}
                  </div>
                </div>
  
                <div style={{ height: 1, background: "var(--line-soft)", margin: "6px 0" }} />
  
                {selectedNode ? (
                  <>
                    <div style={{ fontWeight: 800, fontSize: 12 }}>{selectedNode.label}</div>
                    <div style={{ opacity: 0.85 }}>
                      <div>
                        id:{" "}
                        <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                          {selectedNode.id}
                        </span>
                      </div>
                      <div>kind: {selectedNode.kind}</div>
                      <div>source: {selectedNode.source ?? "-"}</div>
                    </div>
  
                    {(() => {
                      const userId = graph.meta.userId;
                      const panelItems = items.filter(
                        (i) => i.status === "active" && i.sensitivityLevel !== "high" && i.sensitivityLevel !== "blocked",
                      );
  
                      const identityItems = panelItems.filter(
                        (i) => i.type === "declared_fact" || i.type === "constraint" || i.type === "inferred_trait",
                      );
                      const preferenceItems = panelItems.filter((i) => i.type === "preference" || i.type === "interaction_style");
                      const goalItems = panelItems.filter((i) => i.type === "goal");
  
                      const keyFacts = Array.isArray(profile?.keyFacts) ? (profile?.keyFacts ?? []).map((v) => String(v)) : [];
                      const activeGoals = Array.isArray(profile?.activeGoals)
                        ? (profile?.activeGoals ?? []).map((v) => String(v))
                        : [];
                      const recurringTopics = Array.isArray(profile?.recurringTopics)
                        ? (profile?.recurringTopics ?? []).map((v) => String(v))
                        : [];
  
                      const prefsRaw = (profile?.interactionPreferences ?? {}) as Record<string, unknown>;
                      const prefFromProfile = [
                        ...(Array.isArray(prefsRaw.interaction_style) ? (prefsRaw.interaction_style as unknown[]).map((v) => String(v)) : []),
                        ...(Array.isArray(prefsRaw.preferences) ? (prefsRaw.preferences as unknown[]).map((v) => String(v)) : []),
                      ];
  
                      const identityLines = (() => {
                        const base = uniqNonEmpty([...keyFacts, ...identityItems.map((i) => i.content)], 50);
                        const name = extractNameFromText(base);
                        const withName = name ? [`Nome: ${name}`, ...base.filter((v) => !/^nome\s*:/i.test(v))] : base;
                        return uniqNonEmpty(withName, 20);
                      })();
  
                      const preferenceLines = uniqNonEmpty([...preferenceItems.map((i) => i.content), ...prefFromProfile], 20);
                      const goalLines = uniqNonEmpty([...goalItems.map((i) => i.content), ...activeGoals], 20);
                      const topicLines = uniqNonEmpty(recurringTopics, 20);
  
                      const blockStyle: CSSProperties = {
                        margin: 0,
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid var(--line)",
                        background: "var(--surface-glass)",
                        fontSize: 12,
                      };
  
                      const cardStyle: CSSProperties = {
                        padding: "10px 10px",
                        borderRadius: 12,
                        border: "1px solid var(--line)",
                        background: "var(--panel-soft)",
                        boxShadow: "var(--shadow-xs)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      };
  
                      const metaRowStyle: CSSProperties = {
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        opacity: 0.85,
                        fontSize: 11,
                      };
  
                      const chipStyle = (bg: string): CSSProperties => ({
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: "1px solid var(--line)",
                        background: bg,
                        fontWeight: 700,
                        fontSize: 11,
                      });
  
                      function sortBySignal<T extends { relevanceScore?: number; confidenceScore?: number; updatedAt?: string }>(arr: T[]) {
                        return [...arr].sort((a, b) => {
                          const ra = Number(a.relevanceScore ?? 0);
                          const rb = Number(b.relevanceScore ?? 0);
                          if (rb !== ra) return rb - ra;
                          const ca = Number(a.confidenceScore ?? 0);
                          const cb = Number(b.confidenceScore ?? 0);
                          if (cb !== ca) return cb - ca;
                          const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                          const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                          return tb - ta;
                        });
                      }
  
                      function renderMemoryItems(list: UserMemoryItem[], title: string) {
                        const sorted = sortBySignal(list).slice(0, 30);
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={{ fontWeight: 900, fontSize: 12 }}>{title}</div>
                            {sorted.length ? (
                              sorted.map((item) => (
                                <div key={item.id} style={cardStyle}>
                                  <div style={{ fontWeight: 800, fontSize: 12, whiteSpace: "pre-wrap" }}>{item.content}</div>
                                  <div style={metaRowStyle}>
                                    <span style={chipStyle("rgba(37,99,235,0.08)")}>{itemTypeLabel(item.type)}</span>
                                    <span style={chipStyle("rgba(15,23,42,0.04)")}>{item.status}</span>
                                    <span style={chipStyle("rgba(234,88,12,0.08)")}>conf {formatMaybeNumber(item.confidenceScore)}</span>
                                    <span style={chipStyle("rgba(124,58,237,0.08)")}>rel {formatMaybeNumber(item.relevanceScore)}</span>
                                    <span>origem: user_memory_items</span>
                                    <span>atualizado: {formatDate(item.updatedAt)}</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div style={{ opacity: 0.7 }}>Nenhum item ativo nesta categoria.</div>
                            )}
                          </div>
                        );
                      }
  
                      function renderProfileLines(lines: string[], label: string, sourceKey: string) {
                        const trimmed = lines.map((l) => String(l ?? "").trim()).filter(Boolean).slice(0, 30);
                        if (!trimmed.length) return null;
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={{ fontWeight: 900, fontSize: 12 }}>{label}</div>
                            {trimmed.map((text, idx) => (
                              <div key={`${sourceKey}-${idx}-${text}`} style={cardStyle}>
                                <div style={{ fontWeight: 800, fontSize: 12, whiteSpace: "pre-wrap" }}>{text}</div>
                                <div style={metaRowStyle}>
                                  <span style={chipStyle("rgba(15,118,110,0.10)")}>perfil</span>
                                  <span>origem: {sourceKey}</span>
                                  <span>perfil atualizado: {formatDate(profile?.updatedAt ?? null)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      }
  
                      if (selectedNode.kind === "root") {
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={blockStyle}>
                              Este é um grafo estrutural de navegação: o canvas mostra a macroestrutura (sistema → usuário → categorias) e o painel mostra a microestrutura (listas).
                            </div>
                            <div style={{ opacity: 0.9 }}>
                              <div>itens ativos (ok): {graph.meta.memoryItemsIncluded}</div>
                              <div>categorias: 4</div>
                              <div>userId atual: {graph.meta.userId}</div>
                              <div>roadmap: Fase atual — Observação (read-only)</div>
                              <div style={{ opacity: 0.85 }}>
                                status: capturas automáticas {auditSummary?.automaticCaptures ?? 0} • correções manuais{" "}
                                {auditSummary?.manualCorrections ?? 0}
                              </div>
                            </div>
                          </div>
                        );
                      }
  
                      if (selectedNode.kind === "group") {
                        return <div style={blockStyle}>Raiz de usuários. Nesta etapa, o grafo mostra apenas o usuário selecionado.</div>;
                      }
  
                      if (selectedNode.kind === "user") {
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={blockStyle}>
                              <div style={{ fontWeight: 800, marginBottom: 6 }}>summaryShort</div>
                              <div style={{ whiteSpace: "pre-wrap" }}>{profile?.summaryShort?.trim() ? profile.summaryShort : "-"}</div>
                            </div>
                            <div style={{ opacity: 0.9 }}>
                              <div>identidade: {identityItems.length}</div>
                              <div>preferências: {preferenceItems.length}</div>
                              <div>objetivos: {goalItems.length}</div>
                              <div>temas: {topicLines.length}</div>
                              <div>primeiro evento: {formatDate(auditSummary?.firstEventAt ?? null) || "-"}</div>
                              <div>gerado: {formatDate(graph.meta.generatedAt)}</div>
                              <div>perfil atualizado: {formatDate(profile?.updatedAt ?? null)}</div>
                              <div>última compilação: {formatDate(profile?.lastCompiledAt ?? null)}</div>
                            </div>
                          </div>
                        );
                      }
  
                      if (selectedNode.kind === "section") {
                        const sectionId = selectedNode.id;
                        const isIdentity = sectionId === `user-${userId}-identity`;
                        const isPreferences = sectionId === `user-${userId}-preferences`;
                        const isGoals = sectionId === `user-${userId}-goals`;
                        const isTopics = sectionId === `user-${userId}-topics`;
  
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {isIdentity ? (
                              <>
                                {renderMemoryItems(identityItems, "Itens ativos (banco)")}
                                {renderProfileLines(identityLines, "Perfil compilado (resumo)", "user_profile.keyFacts/summaryShort")}
                              </>
                            ) : null}
  
                            {isPreferences ? (
                              <>
                                {renderMemoryItems(preferenceItems, "Preferências ativas (banco)")}
                                {renderProfileLines(preferenceLines, "Perfil compilado (preferências)", "user_profile.interactionPreferences")}
                              </>
                            ) : null}
  
                            {isGoals ? (
                              <>
                                {renderMemoryItems(goalItems, "Objetivos ativos (banco)")}
                                {renderProfileLines(goalLines, "Perfil compilado (objetivos)", "user_profile.activeGoals")}
                              </>
                            ) : null}
  
                            {isTopics ? (
                              <>
                                <div style={{ fontWeight: 900, fontSize: 12 }}>Temas recorrentes</div>
                                {topicLines.length >= 2 ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {topicLines.map((topic, idx) => (
                                      <div key={`${idx}-${topic}`} style={cardStyle}>
                                        <div style={{ fontWeight: 800, fontSize: 12 }}>{topic}</div>
                                        <div style={metaRowStyle}>
                                          <span style={chipStyle("rgba(15,118,110,0.10)")}>perfil</span>
                                          <span>origem: user_profile.recurringTopics</span>
                                          <span>perfil atualizado: {formatDate(profile?.updatedAt ?? null)}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div style={{ ...blockStyle, borderColor: "rgba(234,88,12,0.18)", background: "rgba(234,88,12,0.05)" }}>
                                    Sem temas recorrentes “fortes” ainda. Isso pode acontecer quando:
                                    <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                                      <li>o perfil ainda não foi compilado recentemente, ou</li>
                                      <li>itens ativos não têm `category` consistente o suficiente.</li>
                                    </ul>
                                  </div>
                                )}
                              </>
                            ) : null}
  
                            <div style={{ opacity: 0.72, fontSize: 11 }}>
                              Fonte: `user_profile` + `user_memory_items` (ativos). Sensibilidade high/blocked não é exibida aqui.
                            </div>
                          </div>
                        );
                      }
  
                      return selectedNode.payload ? (
                        <pre
                          style={{
                            margin: 0,
                            padding: 10,
                            borderRadius: 12,
                            border: "1px solid var(--line)",
                            background: "var(--surface-glass)",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            fontSize: 12,
                          }}
                        >
                          {JSON.stringify(selectedNode.payload, null, 2)}
                        </pre>
                      ) : (
                        <div style={{ opacity: 0.7 }}>Sem detalhes adicionais.</div>
                      );
                    })()}
                  </>
                ) : (
                  <div style={{ opacity: 0.7 }}>Clique em um nó para ver detalhes.</div>
                )}
              </div>
            ) : (
              <div style={{ opacity: 0.7, fontSize: 12 }}>Nenhum grafo carregado.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
