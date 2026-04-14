import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/server/request";

export const runtime = "nodejs";

type ExecutionConfig = {
  command: string;
  args: string[];
  extension: string;
  language: string;
};

const EXECUTION_TIMEOUT_MS = 10_000;
const OUTPUT_LIMIT_BYTES = 200_000;

function normalizeLanguage(input: string | undefined) {
  const value = (input || "").trim().toLowerCase();
  if (!value) return "txt";
  if (["js", "javascript", "node", "mjs", "cjs"].includes(value)) return "javascript";
  if (["ts", "typescript"].includes(value)) return "typescript";
  if (["py", "python"].includes(value)) return "python";
  if (["sh", "bash", "shell"].includes(value)) return "bash";
  if (["ps1", "powershell"].includes(value)) return "powershell";
  return value;
}

function getExecutionConfig(language: string): ExecutionConfig {
  switch (language) {
    case "javascript":
      return { command: "node", args: [], extension: ".mjs", language };
    case "typescript":
      return { command: "npx", args: ["tsx"], extension: ".ts", language };
    case "python":
      return { command: "python", args: [], extension: ".py", language };
    case "bash":
      return { command: "bash", args: [], extension: ".sh", language };
    case "powershell":
      return { command: "powershell", args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File"], extension: ".ps1", language };
    default:
      throw new Error(`Linguagem não suportada para execução: ${language}`);
  }
}

function trimOutput(value: string) {
  if (value.length <= OUTPUT_LIMIT_BYTES) return value;
  return `${value.slice(0, OUTPUT_LIMIT_BYTES)}\n\n[output truncado]`;
}

async function runProcess(filePath: string, config: ExecutionConfig) {
  return new Promise<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
  }>((resolve, reject) => {
    const child = spawn(config.command, [...config.args, filePath], {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let finished = false;

    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill();
      reject(new Error(`Execução excedeu o limite de ${EXECUTION_TIMEOUT_MS / 1000}s.`));
    }, EXECUTION_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      if (finished) return;
      finished = true;
      reject(error);
    });

    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      if (finished) return;
      finished = true;
      resolve({
        stdout: trimOutput(stdout),
        stderr: trimOutput(stderr),
        exitCode,
      });
    });
  });
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  const language = normalizeLanguage(typeof body?.language === "string" ? body.language : undefined);

  if (!code.trim()) {
    return NextResponse.json({ error: "Código vazio." }, { status: 400 });
  }

  try {
    const config = getExecutionConfig(language);
    const executionDir = await fs.mkdtemp(path.join(os.tmpdir(), "chocks-exec-"));
    const filePath = path.join(executionDir, `snippet${config.extension}`);
    await fs.writeFile(filePath, code, "utf8");

    const startedAt = Date.now();
    const result = await runProcess(filePath, config);
    const durationMs = Date.now() - startedAt;

    await fs.rm(executionDir, { recursive: true, force: true }).catch(() => null);

    return NextResponse.json({
      ok: result.exitCode === 0,
      language: config.language,
      command: `${config.command} ${[...config.args, filePath].join(" ")}`,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      durationMs,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Falha ao executar código.",
      },
      { status: 400 },
    );
  }
}

