"use client";

import { requestJson } from "./api";

export type CodeExecutionResult = {
  ok: boolean;
  language: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
};

export async function copyCodeToClipboard(code: string) {
  await navigator.clipboard.writeText(code);
}

export async function createFileFromCode(targetPath: string, code: string) {
  return requestJson("/files/action", {
    method: "POST",
    body: JSON.stringify({
      action: "write",
      path: targetPath,
      content: code,
    }),
  });
}

import { isTauri, runNativeCommand } from "./desktop";

export async function executeCodeSnippet(language: string | undefined, code: string): Promise<CodeExecutionResult> {
  const start = Date.now();
  const normalizedLang = (language || "").toLowerCase();
  const isTerminalCmd = ["bash", "sh", "powershell", "ps1", "cmd", "batch", "shell"].includes(normalizedLang);

  // Se estiver no Desktop e for um comando de terminal, roda NATALMENTE
  if (isTauri() && (isTerminalCmd || normalizedLang === "text")) {
    const { output, error } = await runNativeCommand(code);
    return {
      ok: !error,
      language: normalizedLang,
      command: code,
      stdout: output,
      stderr: error || "",
      exitCode: error ? 1 : 0,
      durationMs: Date.now() - start
    };
  }

  // Caso contrario, continua usando o servidor
  return requestJson("/code/execute", {
    method: "POST",
    body: JSON.stringify({
      language,
      code,
    }),
  }) as Promise<CodeExecutionResult>;
}
