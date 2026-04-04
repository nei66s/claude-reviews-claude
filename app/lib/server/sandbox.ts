import path from "node:path";

import { readAppSettings } from "./store";

function containsPath(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeRoots(input: string[]) {
  return Array.from(
    new Set(
      input
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => path.resolve(value)),
    ),
  );
}

function getProtectedRoots() {
  const protectedRoots = [
    process.env.SystemRoot,
    process.env.windir,
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
    process.env.ProgramData,
  ]
    .map((value) => value?.trim())
    .filter(Boolean)
    .map((value) => path.resolve(value as string));

  return Array.from(new Set(protectedRoots));
}

function includesProtectedSegment(target: string) {
  return target
    .split(path.sep)
    .some((segment) => segment.trim().toLowerCase() === ".git");
}

export async function getSandboxSettings() {
  const settings = await readAppSettings();
  const workspaceRoot = path.resolve(process.cwd());
  const configuredRoots = normalizeRoots(settings.sandboxWritableRoots);

  return {
    enabled: settings.sandboxEnabled,
    workspaceRoot,
    writableRoots: configuredRoots.length > 0 ? configuredRoots : [workspaceRoot],
    protectedRoots: getProtectedRoots(),
  };
}

export async function assertSandboxAllowsMutation(targetPath: string, operation: string) {
  const sandbox = await getSandboxSettings();
  const resolvedTarget = path.resolve(targetPath);

  if (!sandbox.enabled) {
    return sandbox;
  }

  if (includesProtectedSegment(resolvedTarget)) {
    throw new Error(`Sandbox bloqueou ${operation}: caminhos dentro de .git nao podem ser alterados.`);
  }

  for (const protectedRoot of sandbox.protectedRoots) {
    if (containsPath(protectedRoot, resolvedTarget)) {
      throw new Error(`Sandbox bloqueou ${operation}: ${resolvedTarget} fica dentro de uma pasta protegida do sistema.`);
    }
  }

  const allowed = sandbox.writableRoots.some((root) => containsPath(root, resolvedTarget));
  if (!allowed) {
    throw new Error(
      `Sandbox bloqueou ${operation}: ${resolvedTarget} esta fora das raizes liberadas para escrita (${sandbox.writableRoots.join(", ")}).`,
    );
  }

  return sandbox;
}
