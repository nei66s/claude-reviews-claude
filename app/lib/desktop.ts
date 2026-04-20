"use client";

import { readDir } from "@tauri-apps/plugin-fs";
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

/**
 * Executa um comando no terminal local (CMD no Windows)
 */
export async function runNativeCommand(command: string, args: string[] = []): Promise<{ output: string; error?: string }> {
    if (!isTauri()) return { output: "", error: "Não está em ambiente Desktop" };
    
    try {
        const { Command } = await import("@tauri-apps/plugin-shell");
        // Solução Atômica v2: Forçamos o OutputEncoding do Console E do PowerShell
        const internalCmd = `${command}${args.length > 0 ? " " + args.join(" ") : ""}`;
        const base64Cmd = `$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $out = (${internalCmd} | Out-String); [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($out))`;
        
        const cmd = Command.create("pwsh", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", base64Cmd]);
        const output = await cmd.execute();
        
        if (!output.stdout && output.stderr) {
            return { output: "", error: output.stderr };
        }

        // Decodificamos o Base64 de volta para string UTF-8 no JavaScript (Client-side safe)
        try {
            const binaryString = window.atob(output.stdout.trim());
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const decodedOutput = new TextDecoder().decode(bytes);
            
            return {
                output: decodedOutput,
                error: output.stderr || undefined
            };
        } catch (_decodeError) {
            return {
                output: output.stdout,
                error: output.stderr || undefined
            };
        }
    } catch (err) {
        const error = err as { toString: () => string };
        console.error("Erro ao executar comando nativo:", err);
        return { output: "", error: error.toString() };
    }
}
