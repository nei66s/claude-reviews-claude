import type { ExtractedCandidate, ExtractorInput } from "./extractor";
import { extractDeterministicMemoryCandidates } from "./extractor";
import { extractLlmAssistedMemoryCandidates } from "./llm-extractor";
import { isLlmMemoryExtractionEnabled } from "./flags";

function dedupeKey(candidate: ExtractedCandidate) {
  return `${candidate.type}|${candidate.normalizedValue}`.toLowerCase();
}

export type HybridExtractionStats = {
  heuristicGenerated: number;
  llmAttempted: boolean;
  llmFailed: boolean;
  llmRaw: number;
  llmAccepted: number;
  llmDiscarded: number;
  combinedTotal: number;
};

export async function extractMemoryCandidates(params: {
  input: ExtractorInput;
  apiKey?: string;
  llmModel?: string;
  maxTotalCandidates?: number;
  maxLlmAccepted?: number;
}): Promise<{ candidates: ExtractedCandidate[]; stats: HybridExtractionStats }> {
  const maxTotalCandidates = Number.isFinite(params.maxTotalCandidates as number)
    ? Math.max(1, Math.min(10, Math.floor(params.maxTotalCandidates as number)))
    : 5;
  const maxLlmAccepted = Number.isFinite(params.maxLlmAccepted as number)
    ? Math.max(0, Math.min(5, Math.floor(params.maxLlmAccepted as number)))
    : 3;

  const heuristic = extractDeterministicMemoryCandidates(params.input);
  const combined: ExtractedCandidate[] = [...heuristic];
  const seen = new Set(combined.map(dedupeKey));

  let llmAttempted = false;
  let llmFailed = false;
  let llmRaw = 0;
  let llmAccepted = 0;
  let llmDiscarded = 0;

  const wantsLlm = isLlmMemoryExtractionEnabled();
  if (wantsLlm && params.apiKey && params.llmModel && combined.length < maxTotalCandidates && maxLlmAccepted > 0) {
    llmAttempted = true;
    try {
      const llm = await extractLlmAssistedMemoryCandidates({
        apiKey: params.apiKey,
        model: params.llmModel,
        input: params.input,
        maxAccepted: maxLlmAccepted,
      });
      llmRaw = llm.rawCount;
      llmAccepted = llm.acceptedCount;
      llmDiscarded = llm.discardedCount;

      for (const candidate of llm.candidates) {
        const key = dedupeKey(candidate);
        if (seen.has(key)) continue;
        if (combined.length >= maxTotalCandidates) break;
        seen.add(key);
        combined.push(candidate);
      }
    } catch {
      // Fallback silencioso: heurística apenas.
      llmFailed = true;
      llmDiscarded = 0;
      llmAccepted = 0;
      llmRaw = 0;
    }
  }

  return {
    candidates: combined.slice(0, maxTotalCandidates),
    stats: {
      heuristicGenerated: heuristic.length,
      llmAttempted,
      llmFailed,
      llmRaw,
      llmAccepted,
      llmDiscarded,
      combinedTotal: Math.min(combined.length, maxTotalCandidates),
    },
  };
}
