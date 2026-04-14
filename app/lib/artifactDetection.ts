import type { TraceEntry } from "./api";

export type ArtifactKind = "code" | "markdown" | "json" | "html" | "text";

export type WebSearchSource = {
  title: string;
  url: string;
  snippet: string;
  date?: string;
};

export type Artifact = {
  id: string;
  kind: ArtifactKind;
  title: string;
  content: string;
  language?: string;
  source: "message" | "trace";
  preview?: string;
};

const CODE_BLOCK_REGEX = /```([\w#+.-]*)\n([\s\S]*?)```/g;
const HTML_REGEX = /<(html|body|main|section|article|div|table|form|style|svg)\b[\s\S]*?>/i;
const MARKDOWN_SIGNAL_REGEX = /(^|\n)(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|\|.+\|)/m;

function createArtifactId(prefix: string, index: number) {
  return `${prefix}-${index}`;
}

function normalizeLanguage(language: string | undefined) {
  const value = (language || "").trim().toLowerCase();
  if (!value) return undefined;
  if (value === "shell") return "bash";
  if (value === "node") return "javascript";
  if (value === "yml") return "yaml";
  return value;
}

function buildPreview(content: string, maxLength = 180) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}...`;
}

function tryParseJson(content: string) {
  try {
    const parsed = JSON.parse(content);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return null;
  }
}

function inferMarkdownArtifact(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const looksMarkdown =
    MARKDOWN_SIGNAL_REGEX.test(trimmed) ||
    trimmed.includes("```") ||
    /\[[^\]]+\]\([^)]+\)/.test(trimmed);

  if (!looksMarkdown || trimmed.length < 240) {
    return null;
  }

  const firstHeading = trimmed.match(/^#{1,6}\s+(.+)$/m)?.[1]?.trim();
  return {
    kind: "markdown" as const,
    title: firstHeading || "Documento Markdown",
    content: trimmed,
    preview: buildPreview(trimmed),
  };
}

function inferHtmlArtifact(content: string) {
  const trimmed = content.trim();
  if (!trimmed || !HTML_REGEX.test(trimmed)) return null;

  return {
    kind: "html" as const,
    title: "Preview HTML",
    content: trimmed,
    preview: buildPreview(trimmed),
  };
}

function inferJsonArtifact(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const prettyJson = tryParseJson(trimmed);
  if (!prettyJson) return null;

  return {
    kind: "json" as const,
    title: "Documento JSON",
    content: prettyJson,
    language: "json",
    preview: buildPreview(prettyJson),
  };
}

export function detectArtifacts(content: string, trace?: TraceEntry[]): Artifact[] {
  const artifacts: Artifact[] = [];
  const trimmed = content.trim();

  const codeMatches = Array.from(trimmed.matchAll(CODE_BLOCK_REGEX));
  for (const [index, match] of codeMatches.entries()) {
    const language = normalizeLanguage(match[1]);
    const code = match[2]?.trimEnd();
    if (!code) continue;

    const kind: ArtifactKind = language === "json" ? "json" : language === "html" ? "html" : "code";
    artifacts.push({
      id: createArtifactId("code", index),
      kind,
      title: language ? `${language.toUpperCase()} Block` : "Code Block",
      content: kind === "json" ? tryParseJson(code) || code : code,
      language,
      source: "message",
      preview: buildPreview(code),
    });
  }

  const jsonArtifact = inferJsonArtifact(trimmed);
  if (jsonArtifact && artifacts.length === 0) {
    artifacts.push({
      id: createArtifactId("json", artifacts.length),
      source: "message",
      ...jsonArtifact,
    });
  }

  const htmlArtifact = inferHtmlArtifact(trimmed);
  if (htmlArtifact && !artifacts.some((artifact) => artifact.kind === "html")) {
    artifacts.push({
      id: createArtifactId("html", artifacts.length),
      source: "message",
      ...htmlArtifact,
    });
  }

  const markdownArtifact = inferMarkdownArtifact(trimmed);
  if (markdownArtifact && !artifacts.some((artifact) => artifact.kind === "markdown")) {
    artifacts.push({
      id: createArtifactId("markdown", artifacts.length),
      source: "message",
      ...markdownArtifact,
    });
  }

  const pdfTrace = Array.isArray(trace)
    ? trace.find((entry) => entry.label === "pdf_report" && entry.state === "complete")
    : null;

  if (pdfTrace?.payload && typeof pdfTrace.payload === "object") {
    const payload = pdfTrace.payload as Record<string, unknown>;
    const output = payload.output && typeof payload.output === "object" ? (payload.output as Record<string, unknown>) : null;
    if (typeof output?.path === "string") {
      artifacts.push({
        id: createArtifactId("trace", artifacts.length),
        kind: "text",
        title: "PDF gerado",
        content: `Arquivo PDF criado em:\n${output.path}`,
        source: "trace",
        preview: output.path,
      });
    }
  }

  return artifacts;
}

export function pickPrimaryArtifact(content: string, trace?: TraceEntry[]) {
  return detectArtifacts(content, trace)[0] ?? null;
}

export function extractWebSources(trace?: TraceEntry[]): WebSearchSource[] {
  if (!Array.isArray(trace)) return [];

  const results: WebSearchSource[] = [];

  for (const entry of trace) {
    if (entry.label !== "web_search" || entry.state !== "complete") {
      continue;
    }

    const payload = entry.payload && typeof entry.payload === "object" ? (entry.payload as Record<string, unknown>) : null;
    const output = payload?.output && typeof payload.output === "object" ? (payload.output as Record<string, unknown>) : null;
    const searchResults = Array.isArray(output?.results) ? output.results : [];

    for (const item of searchResults) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const title = typeof record.title === "string" ? record.title : "";
      const url = typeof record.url === "string" ? record.url : "";
      if (!title || !url) continue;

      results.push({
        title,
        url,
        snippet: typeof record.snippet === "string" ? record.snippet : "",
        date: typeof record.date === "string" ? record.date : undefined,
      });
    }
  }

  return results;
}
