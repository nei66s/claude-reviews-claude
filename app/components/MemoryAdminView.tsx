"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../lib/auth";
import { requestJson } from "../lib/api";

type UserProfile = {
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

type MemoryAuditEvent = {
  id: number;
  memoryItemId: string;
  userId: string;
  action: string;
  previousStatus: string | null;
  newStatus: string | null;
  reason: string;
  actor: string;
  createdAt: string;
  itemType: string | null;
  itemStatus: string | null;
  itemContentPreview: string | null;
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

type IngestionLogEntry = {
  id: number;
  messageId: number | null;
  conversationId: string;
  status: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUSES = ["", "candidate", "active", "archived", "contradicted", "deleted"] as const;
const TYPES = ["", "declared_fact", "preference", "goal", "constraint", "interaction_style", "inferred_trait"] as const;
type StatusFilter = (typeof STATUSES)[number];
type TypeFilter = (typeof TYPES)[number];

function coerceStatusFilter(value: string): StatusFilter {
  return (STATUSES as readonly string[]).includes(value) ? (value as StatusFilter) : "";
}

function coerceTypeFilter(value: string): TypeFilter {
  return (TYPES as readonly string[]).includes(value) ? (value as TypeFilter) : "";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("pt-BR");
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "";
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "";
  const deltaMs = Date.now() - ts;
  if (deltaMs < 0) return "agora";

  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 60) return `há ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} horas`;
  const days = Math.floor(hours / 24);
  return `há ${days} dias`;
}

function daysSince(value: string | null | undefined) {
  if (!value) return null;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return null;
  const deltaDays = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
  return Math.max(0, deltaDays);
}

export default function MemoryAdminPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [targetUserId, setTargetUserId] = useState("");
  const [userList, setUserList] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("");
  const [limit, setLimit] = useState(500);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [items, setItems] = useState<UserMemoryItem[]>([]);
  const [auditSummary, setAuditSummary] = useState<MemoryAuditSummary | null>(null);
  const [auditEvents, setAuditEvents] = useState<MemoryAuditEvent[]>([]);
  const [ingestionLogs, setIngestionLogs] = useState<IngestionLogEntry[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editNormalizedValue, setEditNormalizedValue] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const [simQuery, setSimQuery] = useState("");
  const [simAgentType, setSimAgentType] = useState<string>("");
  const [simResults, setSimResults] = useState<UserMemoryItem[]>([]);
  const [simulating, setSimulating] = useState(false);

  // const canInspectOtherUsers = user?.id === "local-admin";

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }

    if (user && !targetUserId) {
      setTargetUserId(user.id);
    }
    
    // Fetch users list for dropdown
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

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("type", typeFilter);
    if (limit) params.set("limit", String(limit));
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [statusFilter, typeFilter, limit]);

  const auditQueryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "100");
    return `?${params.toString()}`;
  }, []);

  const loadData = useCallback(async () => {
    const userId = targetUserId.trim();
    if (!userId) return;
    setLoading(true);
    setError(null);
    setEditingId(null);
    try {
      const [profileResp, itemsResp, auditResp, ingestionResp] = await Promise.all([
        requestJson(`/memory/users/${encodeURIComponent(userId)}/profile`),
        requestJson(`/memory/users/${encodeURIComponent(userId)}/items${queryString}`),
        requestJson(`/memory/users/${encodeURIComponent(userId)}/audit${auditQueryString}`),
        requestJson(`/memory/users/${encodeURIComponent(userId)}/ingestion?limit=100`),
      ]);
      setProfile(profileResp?.profile ?? null);
      setItems(Array.isArray(itemsResp?.items) ? (itemsResp.items as UserMemoryItem[]) : []);
      setAuditSummary(auditResp?.summary ?? null);
      setAuditEvents(Array.isArray(auditResp?.events) ? (auditResp.events as MemoryAuditEvent[]) : []);
      setIngestionLogs(Array.isArray(ingestionResp?.logs) ? (ingestionResp.logs as IngestionLogEntry[]) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [targetUserId, queryString, auditQueryString]);

  // Auto-load data when filters or userId change
  useEffect(() => {
    if (targetUserId) {
      void loadData();
    }
  }, [targetUserId, loadData]);

  const compileProfile = async () => {
    const userId = targetUserId.trim();
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await requestJson(`/memory/profile/compile`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      setProfile(resp?.profile ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao compilar perfil.");
    } finally {
      setLoading(false);
    }
  };

  const patchItem = async (itemId: string, patch: Record<string, unknown>) => {
    const userId = targetUserId.trim();
    setLoading(true);
    setError(null);
    try {
      const resp = await requestJson(`/memory/users/${encodeURIComponent(userId)}/items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      const updatedItem = resp?.item as UserMemoryItem | undefined;
      if (updatedItem) {
        setItems((prev) => prev.map((it) => (it.id === updatedItem.id ? updatedItem : it)));
      }
      // Always reload all data to get fresh audit summary and recompiled profile
      await loadData();
      setEditingId(null);
    } finally {
      setLoading(false);
    }
  };

  const simulateSelection = async () => {
    const userId = targetUserId.trim();
    if (!userId) return;
    setSimulating(true);
    try {
      const resp = await requestJson(`/memory/context/build`, {
        method: "POST",
        body: JSON.stringify({
          userId,
          query: simQuery,
          agentType: simAgentType || undefined,
          limitItems: 10,
        }),
      });
      setSimResults(Array.isArray(resp?.memoryItems) ? resp.memoryItems : []);
    } catch (err) {
      console.error("Simulation failed", err);
    } finally {
      setSimulating(false);
    }
  };

  const startEdit = (item: UserMemoryItem) => {
    setEditingId(item.id);
    setEditContent(item.content);
    setEditNormalizedValue(item.normalizedValue);
    setEditCategory(item.category);
  };

  const headerStyle: React.CSSProperties = { padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" };
  const containerStyle: React.CSSProperties = { padding: "18px", maxWidth: 1200, margin: "0 auto" };
  const badgeStyle: React.CSSProperties = { display: "inline-block", fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.08)" };
  const rowStyle: React.CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" };
  const inputStyle: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.2)",
    color: "inherit",
  };
  const buttonStyle: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.08)",
    color: "inherit",
    cursor: "pointer",
  };

  if (isLoading || !user) {
    return null;
  }

  const firstEventAt = auditSummary?.firstEventAt ?? null;
  const observedDays = daysSince(firstEventAt);
  const autoCaptures = auditSummary?.automaticCaptures ?? 0;
  const manualCorrections = auditSummary?.manualCorrections ?? 0;

  const isPhase2Done = true; // Forçamos como concluído pois acabamos de validar a Fase 15

  const readinessState = isPhase2Done
    ? "concluído"
    : autoCaptures >= 25 || manualCorrections >= 8 || (observedDays !== null && observedDays >= 5)
      ? "pronto para fase 2"
      : autoCaptures >= 15 || manualCorrections >= 5 || (observedDays !== null && observedDays >= 3)
        ? "quase pronto para fase 2"
        : "cedo demais";

  const readinessMessage =
    readinessState === "concluído"
      ? "O Memory Orchestrator está plenamente operacional e em produção."
      : readinessState === "cedo demais"
        ? "Ainda observe mais antes da Fase 2."
        : readinessState === "quase pronto para fase 2"
          ? "Já há sinal suficiente surgindo; continue observando."
          : "Já há evidência suficiente para iniciar a Fase 2.";

  const readinessNextAction =
    readinessState === "concluído"
      ? "Próximos passos: monitoramento de performance e refino contínuo de contexto semântico."
      : readinessState === "pronto para fase 2"
        ? "Próximo passo: implementar governança persistente da ingestão (rate-limit/estado no banco)."
        : "Ação agora: continue usando o chat com a flag ligada e faça correções manuais quando necessário.";

  const correctionRate =
    autoCaptures > 0 ? Math.round((manualCorrections / autoCaptures) * 1000) / 10 : null;

  return (
    <div className="view" style={{ overflow: "auto" }}>
      <div style={headerStyle}>
        <div style={rowStyle}>
          <strong>Memory Admin</strong>
          <span style={badgeStyle}>interno</span>
          <span style={{ opacity: 0.7, fontSize: 13 }}>Ferramenta de gestão de cognição.</span>
          <span style={{ ...badgeStyle, opacity: 0.85, background: 'var(--accent)', color: 'white' }}>Fase Final: Operacional</span>
        </div>
      </div>

      <div style={containerStyle}>
        <div style={{ ...rowStyle, marginBottom: 14 }}>
          <label style={{ fontSize: 13, opacity: 0.75 }}>Usuário</label>
          <select
            id="user-select"
            style={{ ...inputStyle, minWidth: 240, cursor: 'pointer' }}
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
          >
            {userList.length === 0 && (
               <option value={targetUserId}>{targetUserId} (carregando...)</option>
            )}
            {userList.map(uid => (
              <option key={uid} value={uid}>
                {uid} {uid === user?.id ? '(você)' : ''}
              </option>
            ))}
          </select>

          <label style={{ fontSize: 13, opacity: 0.75 }}>Status</label>
          <select
            style={inputStyle}
            value={statusFilter}
            onChange={(e) => setStatusFilter(coerceStatusFilter(e.target.value))}
          >
            <option value="">(todos)</option>
            {STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <label style={{ fontSize: 13, opacity: 0.75 }}>Tipo</label>
          <select
            style={inputStyle}
            value={typeFilter}
            onChange={(e) => setTypeFilter(coerceTypeFilter(e.target.value))}
          >
            <option value="">(todos)</option>
            {TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <label style={{ fontSize: 13, opacity: 0.75 }}>Limite</label>
          <input
            style={{ ...inputStyle, width: 90 }}
            type="number"
            min={1}
            max={1000}
            value={limit}
            onChange={(e) => setLimit(Math.max(1, Math.min(1000, Number(e.target.value) || 500)))}
          />
        </div>

        {error ? (
          <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
            {error}
          </div>
        ) : null}

        <div style={{ marginBottom: 18, padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
          <div style={{ ...rowStyle, marginBottom: 14 }}>
            <strong style={{ fontSize: 16 }}>Motor de Cognição</strong>
            <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.6 }}>{readinessState}</span>
          </div>
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 10, opacity: 0.9 }}>
            <span style={badgeStyle}>capturas automáticas: {autoCaptures}</span>
            <span style={badgeStyle}>correções manuais: {manualCorrections}</span>
            <span style={badgeStyle}>
              dias corridos: {observedDays === null ? "-" : observedDays}
            </span>
          </div>
          <div style={{ marginTop: 10, opacity: 0.9 }}>{readinessMessage}</div>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>{readinessNextAction}</div>
          <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
            Você está observando: o que entra automaticamente via chat, o que precisa de correção manual, e a estabilidade dos sinais ao longo dos dias.
          </div>
        </div>

        <div style={{ marginBottom: 18, padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
          <div style={{ ...rowStyle, justifyContent: "space-between" }}>
            <strong>Sinais de qualidade</strong>
            <span style={{ opacity: 0.7, fontSize: 12 }}>
              início: {firstEventAt ? `${formatDate(firstEventAt)} (${formatRelativeTime(firstEventAt)})` : "-"}
            </span>
          </div>
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 10 }}>
            <span style={badgeStyle}>automático: {autoCaptures}</span>
            <span style={badgeStyle}>manual: {manualCorrections}</span>
            <span style={badgeStyle}>arquivados: {auditSummary?.archived ?? 0}</span>
            <span style={badgeStyle}>contraditos: {auditSummary?.contradicted ?? 0}</span>
            <span style={badgeStyle}>deletados: {auditSummary?.deleted ?? 0}</span>
            <span style={badgeStyle}>
              taxa de correção: {correctionRate === null ? "-" : `${correctionRate}%`}
            </span>
          </div>
          <div style={{ marginTop: 10, opacity: 0.75, fontSize: 13 }}>
            Observação recomendada: manter a flag ligada, corrigir itens incorretos, e acompanhar se o volume/qualidade estabiliza antes de endurecer a ingestão (Fase 2).
          </div>
        </div>

        <div style={{ marginBottom: 18, padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
          <div style={{ ...rowStyle, justifyContent: "space-between" }}>
            <strong>Perfil consolidado</strong>
            <span style={{ opacity: 0.7, fontSize: 12 }}>
              version {profile?.profileVersion ?? 0} • atualizado {formatDate(profile?.updatedAt)}
            </span>
          </div>
          <div style={{ marginTop: 10, opacity: 0.85, whiteSpace: "pre-wrap" }}>{profile?.summaryShort || "(vazio)"}</div>
          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: "pointer" }}>Ver summary_long</summary>
            <pre style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "rgba(0,0,0,0.25)", overflowX: "auto" }}>
              {profile?.summaryLong || ""}
            </pre>
          </details>
        </div>

        <div style={{ marginBottom: 18, padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
          <div style={{ ...rowStyle, justifyContent: "space-between" }}>
            <strong>Simulador de Seleção (DEBUG Fase 13/14)</strong>
            <span style={{ opacity: 0.7, fontSize: 12 }}>Teste como o ranking está funcionando</span>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <input 
              style={{ ...inputStyle, flex: 1 }} 
              placeholder="Digite uma query (ex: 'café', 'projeto obsidian')..." 
              value={simQuery}
              onChange={e => setSimQuery(e.target.value)}
            />
            <select 
              style={inputStyle}
              value={simAgentType}
              onChange={e => setSimAgentType(e.target.value)}
            >
              <option value="">(sem agente)</option>
              <option value="coder">coder</option>
              <option value="doutora-kitty">doutora-kitty</option>
            </select>
            <button style={buttonStyle} onClick={simulateSelection} disabled={simulating || !targetUserId}>
              {simulating ? "Calculando..." : "Simular"}
            </button>
          </div>
          {simResults.length > 0 && (
            <div style={{ marginTop: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 8 }}>Itens selecionados (em ordem de prioridade):</div>
              {simResults.map((it, idx) => (
                <div key={it.id} style={{ fontSize: 13, padding: '4px 0', borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ opacity: 0.6 }}>#{idx + 1}</span> <span style={badgeStyle}>{it.type}</span> <strong>{it.category}</strong>: {it.content}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 18, padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
          <div style={{ ...rowStyle, justifyContent: "space-between" }}>
            <strong>Governança de Ingestão (Idempotência / Rate-Limit)</strong>
            <span style={{ opacity: 0.7, fontSize: 12 }}>
              últimas {ingestionLogs.length} mensagens processadas
            </span>
          </div>
          <div style={{ marginTop: 10, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "190px 140px 140px 1fr 140px", background: "rgba(255,255,255,0.06)" }}>
              {["Data", "Status", "Message ID", "Reason / Context", "Conversation"].map((h) => (
                <div key={h} style={{ padding: "10px 12px", fontSize: 12, opacity: 0.8, fontWeight: 600 }}>
                  {h}
                </div>
              ))}
            </div>
            {ingestionLogs.map((log) => (
              <div
                key={log.id}
                style={{ display: "grid", gridTemplateColumns: "190px 140px 140px 1fr 140px", borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div style={{ padding: "10px 12px", fontSize: 12, opacity: 0.85 }}>
                  {formatDate(log.createdAt)}
                </div>
                <div style={{ padding: "10px 12px", fontSize: 12 }}>
                  <span style={{ 
                    ...badgeStyle, 
                    background: log.status === 'completed' ? 'rgba(34,197,94,0.15)' : 
                               log.status === 'error' ? 'rgba(239,68,68,0.15)' :
                               log.status === 'rate_limited' ? 'rgba(234,179,8,0.15)' :
                               'rgba(255,255,255,0.08)' 
                  }}>
                    {log.status}
                  </span>
                </div>
                <div style={{ padding: "10px 12px", fontSize: 12, opacity: 0.9 }}>{log.messageId || "-"}</div>
                <div style={{ padding: "10px 12px", fontSize: 12, opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {log.reason || "-"}
                </div>
                <div style={{ padding: "10px 12px", fontSize: 12, opacity: 0.7 }}>{log.conversationId}</div>
              </div>
            ))}
            {ingestionLogs.length === 0 ? (
              <div style={{ padding: 12, opacity: 0.7 }}>Nenhum log de governança disponível.</div>
            ) : null}
          </div>
        </div>

        <div style={{ marginBottom: 18, padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
          <div style={{ ...rowStyle, justifyContent: "space-between" }}>
            <strong>Linha de auditoria</strong>
            <span style={{ opacity: 0.7, fontSize: 12 }}>
              últimos {auditEvents.length} eventos • use esta linha para fechar a Fase 1
            </span>
          </div>
          <div style={{ marginTop: 10, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "190px 110px 140px 1fr 220px", background: "rgba(255,255,255,0.06)" }}>
              {["Quando", "Ação", "Actor", "Reason / Item", "IDs"].map((h) => (
                <div key={h} style={{ padding: "10px 12px", fontSize: 12, opacity: 0.8, fontWeight: 600 }}>
                  {h}
                </div>
              ))}
            </div>
            {auditEvents.map((ev) => (
              <div
                key={ev.id}
                style={{ display: "grid", gridTemplateColumns: "190px 110px 140px 1fr 220px", borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div style={{ padding: "10px 12px", fontSize: 12, opacity: 0.85 }}>
                  <div>{formatDate(ev.createdAt)}</div>
                  <div style={{ opacity: 0.7 }}>{formatRelativeTime(ev.createdAt)}</div>
                </div>
                <div style={{ padding: "10px 12px", fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>{ev.action}</div>
                  <div style={{ opacity: 0.7, marginTop: 4 }}>
                    {ev.previousStatus || "-"} → {ev.newStatus || "-"}
                  </div>
                </div>
                <div style={{ padding: "10px 12px", fontSize: 12, opacity: 0.9 }}>{ev.actor || "-"}</div>
                <div style={{ padding: "10px 12px", fontSize: 12, opacity: 0.9 }}>
                  <div style={{ opacity: 0.8 }}>{ev.reason || "-"}</div>
                  {ev.itemType || ev.itemContentPreview ? (
                    <div style={{ marginTop: 6, opacity: 0.75 }}>
                      {ev.itemType ? `${ev.itemType}${ev.itemStatus ? ` (${ev.itemStatus})` : ""}` : ""}
                      {ev.itemContentPreview ? ` — ${ev.itemContentPreview}` : ""}
                    </div>
                  ) : null}
                </div>
                <div style={{ padding: "10px 12px", fontSize: 11, opacity: 0.75 }}>
                  <div>item: {ev.memoryItemId}</div>
                  <div>event: {ev.id}</div>
                </div>
              </div>
            ))}
            {auditEvents.length === 0 ? (
              <div style={{ padding: 12, opacity: 0.7 }}>Sem eventos de auditoria ainda.</div>
            ) : null}
          </div>
        </div>

        <div style={{ marginBottom: 10, opacity: 0.85 }}>
          <strong>Itens de memória</strong> <span style={{ opacity: 0.7 }}>({items.length})</span>
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "140px 120px 1fr 160px 180px 240px", gap: 0, background: "rgba(255,255,255,0.06)" }}>
            {["Tipo", "Status", "Conteúdo", "Categoria", "Origem", "Ações"].map((h) => (
              <div key={h} style={{ padding: "10px 12px", fontSize: 12, opacity: 0.8, fontWeight: 600 }}>
                {h}
              </div>
            ))}
          </div>
          {items.map((item) => {
            const isEditing = editingId === item.id;
            return (
              <div
                key={item.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 120px 1fr 160px 180px 240px",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ padding: "10px 12px", fontSize: 13 }}>
                  <div style={{ fontWeight: 600 }}>{item.type}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>{item.sensitivityLevel}</div>
                </div>
                <div style={{ padding: "10px 12px", fontSize: 13 }}>
                  <div>{item.status}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>{formatDate(item.updatedAt)}</div>
                </div>
                <div style={{ padding: "10px 12px", fontSize: 13 }}>
                  {!isEditing ? (
                    <>
                      <div style={{ whiteSpace: "pre-wrap" }}>{item.content}</div>
                      <div style={{ opacity: 0.65, fontSize: 12, marginTop: 6 }}>norm: {item.normalizedValue || "(vazio)"}</div>
                      <div style={{ opacity: 0.65, fontSize: 12 }}>conf: {item.confidenceScore} • rel: {item.relevanceScore}</div>
                    </>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <textarea
                        style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                      />
                      <input
                        style={inputStyle}
                        value={editNormalizedValue}
                        onChange={(e) => setEditNormalizedValue(e.target.value)}
                        placeholder="normalizedValue (opcional)"
                      />
                    </div>
                  )}
                </div>
                <div style={{ padding: "10px 12px", fontSize: 13 }}>
                  {!isEditing ? (
                    <div>{item.category || "(vazio)"}</div>
                  ) : (
                    <input style={inputStyle} value={editCategory} onChange={(e) => setEditCategory(e.target.value)} />
                  )}
                </div>
                <div style={{ padding: "10px 12px", fontSize: 12, opacity: 0.8 }}>
                  <div>conv: {item.sourceConversationId}</div>
                  <div>msg: {item.sourceMessageId ?? "-"}</div>
                  <div>criado: {formatDate(item.createdAt)}</div>
                </div>
                <div style={{ padding: "10px 12px", display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {!isEditing ? (
                    <>
                      <button style={buttonStyle} onClick={() => startEdit(item)} disabled={loading}>
                        Editar
                      </button>
                      <button
                        style={buttonStyle}
                        onClick={() => patchItem(item.id, { status: "contradicted", reason: "manual_incorrect" })}
                        disabled={loading}
                      >
                        Incorreto
                      </button>
                      <button
                        style={buttonStyle}
                        onClick={() => patchItem(item.id, { status: "archived", reason: "manual_archive" })}
                        disabled={loading}
                      >
                        Arquivar
                      </button>
                      <button
                        style={{ ...buttonStyle, borderColor: "rgba(239,68,68,0.35)" }}
                        onClick={() => {
                          const ok = window.confirm("Marcar este item como deleted?");
                          if (!ok) return;
                          void patchItem(item.id, { status: "deleted", reason: "manual_delete" });
                        }}
                        disabled={loading}
                      >
                        Remover
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        style={buttonStyle}
                        onClick={() =>
                          patchItem(item.id, {
                            content: editContent,
                            normalizedValue: editNormalizedValue,
                            category: editCategory,
                            reason: "manual_edit",
                          })
                        }
                        disabled={loading}
                      >
                        Salvar
                      </button>
                      <button style={buttonStyle} onClick={() => setEditingId(null)} disabled={loading}>
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {items.length === 0 ? (
            <div style={{ padding: 14, opacity: 0.7 }}>Nenhum item encontrado com os filtros atuais.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
