"use client";

import { readDir, BaseDirectory } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";

/**
 * Detecta se o app está rodando dentro do ambiente Tauri (Desktop)
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== undefined;
}

/**
 * Interface simples para representar arquivos/pastas
 */
export interface LocalFile {
  name: string;
  path: string;
  isDir: boolean;
  size?: number;
}

/**
 * Lista os arquivos de um diretório local
 */
export async function listLocalFiles(path?: string): Promise<LocalFile[]> {
  if (!isTauri()) return [];

  try {
    // Se não passar caminho, começa pela Home do usuário
    const targetPath = path || (await homeDir());
    const entries = await readDir(targetPath);
    
    return entries.map(entry => ({
      name: entry.name || "Sem nome",
      path: `${targetPath}/${entry.name}`,
      isDir: entry.isDirectory,
    })).sort((a, b) => {
        // Diretorios primeiro
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error("Erro ao ler diretório nativo:", error);
    return [];
  }
}

/**
 * Lê o conteúdo de um arquivo local como texto
 */
export async function readLocalTextFile(path: string): Promise<string> {
    if (!isTauri()) return "";
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    return await readTextFile(path);
}

/**
 * Escreve texto em um arquivo local
 */
export async function writeLocalTextFile(path: string, content: string): Promise<void> {
    if (!isTauri()) return;
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(path, content);
}
