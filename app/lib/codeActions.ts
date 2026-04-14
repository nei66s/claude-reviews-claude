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

export async function executeCodeSnippet(language: string | undefined, code: string) {
  return requestJson("/code/execute", {
    method: "POST",
    body: JSON.stringify({
      language,
      code,
    }),
  }) as Promise<CodeExecutionResult>;
}
