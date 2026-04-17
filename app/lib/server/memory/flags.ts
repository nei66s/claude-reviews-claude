function envFlag(name: string) {
  const raw = process.env[name];
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

export function isMemoryOrchestratorEnabled() {
  return envFlag("ENABLE_MEMORY_ORCHESTRATOR");
}

export function isLlmMemoryExtractionEnabled() {
  return envFlag("ENABLE_LLM_MEMORY_EXTRACTION");
}

