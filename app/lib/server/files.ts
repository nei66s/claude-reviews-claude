import fs from "node:fs/promises";
import path from "node:path";

import { readAppSettings } from "./store";
import { assertSandboxAllowsMutation } from "./sandbox";

const MAX_TEXT_PREVIEW_BYTES = 512 * 1024;

function getComputerRoot() {
  const parsed = path.parse(process.cwd());
  return parsed.root || process.cwd();
}

function normalizePathForClient(value: string) {
  return value.replaceAll("\\", "/");
}

function isIgnorableStatError(error: unknown) {
  if (!(error instanceof Error) || !("code" in error)) {
    return false;
  }

  const code = String(error.code);
  return code === "EPERM" || code === "EACCES" || code === "ENOENT";
}

async function getOptionalEntrySize(fullPath: string) {
  try {
    const stat = await fs.stat(fullPath);
    return stat.size;
  } catch (error) {
    if (isIgnorableStatError(error)) {
      return undefined;
    }
    throw error;
  }
}

function isTextExtension(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  return [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".md",
    ".txt",
    ".css",
    ".html",
    ".xml",
    ".yml",
    ".yaml",
    ".env",
    ".py",
    ".java",
    ".c",
    ".cpp",
    ".cs",
    ".go",
    ".rs",
    ".sql",
    ".sh",
    ".ps1",
    ".log",
  ].includes(ext);
}

function isImageExtension(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  return [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"].includes(ext);
}

export async function resolveFileScope(inputPath: string) {
  const settings = await readAppSettings();
  const workspaceRoot = process.cwd();
  const baseRoot = settings.fullAccess ? getComputerRoot() : workspaceRoot;
  const target = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(baseRoot, inputPath || ".");

  if (!settings.fullAccess && target !== workspaceRoot && !target.startsWith(`${workspaceRoot}${path.sep}`)) {
    throw new Error("Path outside project");
  }

  return {
    fullAccess: settings.fullAccess,
    permissionMode: settings.permissionMode,
    workspaceRoot,
    baseRoot,
    target,
  };
}

export async function assertFileMutationAllowed(toolName: string) {
  const settings = await readAppSettings();
  if (settings.permissionMode === "read_only") {
    throw new Error("Modo somente leitura ativo. Desative em Configuracoes para alterar arquivos.");
  }
  if (settings.permissionMode === "ask" && !settings.approvedTools.includes(toolName)) {
    throw new Error(`Aprovacao necessaria para ${toolName}. Libere essa tool em Configuracoes.`);
  }
  return settings;
}

export async function listFileEntries(inputPath: string) {
  const scope = await resolveFileScope(inputPath);
  const dirents = await fs.readdir(scope.target, { withFileTypes: true });
  const entries = await Promise.all(
    dirents.map(async (entry) => {
      const fullPath = path.join(scope.target, entry.name);
      return {
        name: entry.name,
        path: scope.fullAccess
          ? normalizePathForClient(fullPath)
          : normalizePathForClient(path.relative(scope.baseRoot, fullPath)) || ".",
        isDir: entry.isDirectory(),
        size: entry.isDirectory() ? undefined : await getOptionalEntrySize(fullPath),
      };
    }),
  );

  entries.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));

  return {
    entries,
    currentPath: scope.fullAccess
      ? normalizePathForClient(scope.target)
      : normalizePathForClient(path.relative(scope.baseRoot, scope.target)) || ".",
    fullAccess: scope.fullAccess,
  };
}

export async function readFileForPreview(inputPath: string) {
  const scope = await resolveFileScope(inputPath);
  const stat = await fs.stat(scope.target);
  if (!stat.isFile()) {
    throw new Error("Path is not a file");
  }

  const clientPath = scope.fullAccess
    ? normalizePathForClient(scope.target)
    : normalizePathForClient(path.relative(scope.baseRoot, scope.target)) || ".";

  if (isImageExtension(scope.target)) {
    return {
      kind: "image" as const,
      path: clientPath,
      size: stat.size,
      editable: false,
    };
  }

  if (stat.size > MAX_TEXT_PREVIEW_BYTES && !isTextExtension(scope.target)) {
    return {
      kind: "binary" as const,
      path: clientPath,
      size: stat.size,
      editable: false,
    };
  }

  const content = await fs.readFile(scope.target, "utf8");
  return {
    kind: "text" as const,
    path: clientPath,
    size: stat.size,
    editable: true,
    content,
  };
}

export async function writeFileContents(inputPath: string, content: string) {
  await assertFileMutationAllowed("file_write");
  const scope = await resolveFileScope(inputPath);
  await assertSandboxAllowsMutation(scope.target, "file_write");
  await fs.mkdir(path.dirname(scope.target), { recursive: true });
  await fs.writeFile(scope.target, content, "utf8");
  return {
    path: scope.fullAccess
      ? normalizePathForClient(scope.target)
      : normalizePathForClient(path.relative(scope.baseRoot, scope.target)) || ".",
    bytes: content.length,
  };
}

export async function createEmptyFile(inputPath: string) {
  return writeFileContents(inputPath, "");
}

export async function createDirectory(inputPath: string) {
  await assertFileMutationAllowed("directory_create");
  const scope = await resolveFileScope(inputPath);
  await assertSandboxAllowsMutation(scope.target, "directory_create");
  await fs.mkdir(scope.target, { recursive: true });
  return {
    path: scope.fullAccess
      ? normalizePathForClient(scope.target)
      : normalizePathForClient(path.relative(scope.baseRoot, scope.target)) || ".",
  };
}

export async function moveFileSystemEntry(fromPath: string, toPath: string) {
  await assertFileMutationAllowed("file_move");
  const fromScope = await resolveFileScope(fromPath);
  const toScope = await resolveFileScope(toPath);
  await assertSandboxAllowsMutation(fromScope.target, "file_move");
  await assertSandboxAllowsMutation(toScope.target, "file_move");
  await fs.mkdir(path.dirname(toScope.target), { recursive: true });
  await fs.rename(fromScope.target, toScope.target);
  return {
    fromPath: fromScope.fullAccess
      ? normalizePathForClient(fromScope.target)
      : normalizePathForClient(path.relative(fromScope.baseRoot, fromScope.target)) || ".",
    toPath: toScope.fullAccess
      ? normalizePathForClient(toScope.target)
      : normalizePathForClient(path.relative(toScope.baseRoot, toScope.target)) || ".",
  };
}

export async function copyFileSystemEntry(fromPath: string, toPath: string) {
  await assertFileMutationAllowed("file_copy");
  const fromScope = await resolveFileScope(fromPath);
  const toScope = await resolveFileScope(toPath);
  const stat = await fs.stat(fromScope.target);
  await assertSandboxAllowsMutation(toScope.target, "file_copy");
  await fs.mkdir(path.dirname(toScope.target), { recursive: true });
  if (stat.isDirectory()) {
    await fs.cp(fromScope.target, toScope.target, { recursive: true });
  } else {
    await fs.copyFile(fromScope.target, toScope.target);
  }
  return {
    fromPath: fromScope.fullAccess
      ? normalizePathForClient(fromScope.target)
      : normalizePathForClient(path.relative(fromScope.baseRoot, fromScope.target)) || ".",
    toPath: toScope.fullAccess
      ? normalizePathForClient(toScope.target)
      : normalizePathForClient(path.relative(toScope.baseRoot, toScope.target)) || ".",
  };
}

export async function deleteFileSystemEntry(inputPath: string) {
  await assertFileMutationAllowed("file_delete");
  const scope = await resolveFileScope(inputPath);
  const stat = await fs.stat(scope.target);
  await assertSandboxAllowsMutation(scope.target, "file_delete");
  if (stat.isDirectory()) {
    await fs.rm(scope.target, { recursive: true, force: true });
  } else {
    await fs.unlink(scope.target);
  }
  return {
    path: scope.fullAccess
      ? normalizePathForClient(scope.target)
      : normalizePathForClient(path.relative(scope.baseRoot, scope.target)) || ".",
  };
}
