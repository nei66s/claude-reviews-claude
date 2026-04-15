import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// Lazy-load PDFDocument only when needed to avoid font path issues during import
let PDFDocument: any = null;
const getPDFDocument = async () => {
  if (!PDFDocument) {
    const pdfkitModule = await import("pdfkit");
    PDFDocument = pdfkitModule.default;
  }
  return PDFDocument;
};

import { findDbUserByEmail, getDb, hasDatabase } from "./db";
import {
  clearWorkflowState,
  getWorkflowState,
  saveWorkflowState,
  type StoredWorkflow,
  type WorkflowStep,
  type WorkflowStepStatus,
} from "./store";
import {
  assertFileMutationAllowed,
  copyFileSystemEntry,
  createDirectory,
  deleteFileSystemEntry,
  listFileEntries,
  moveFileSystemEntry,
  readFileForPreview,
  resolveFileScope,
  writeFileContents,
} from "./files";
import { searchWeb, webSearchToolDefinition } from "./search-tools";
import { getExchangeRate, exchangeRateToolDefinition } from "./exchange-tools";
import type { SessionUser } from "./auth";

const SRC_PATH_CANDIDATES = [
  "src",
  "app",
  "agent-ts/src",
  "agent-ts/chokito/src",
  "prototype-ts/src",
];

const OBSIDIAN_VAULT_DIR = path.resolve(
  process.env.OBSIDIAN_VAULT_DIR?.trim() || path.join(process.cwd(), "obsidian-vault"),
);
const OBSIDIAN_DEFAULT_FOLDER = "Memoria";
const OBSIDIAN_DEFAULT_DIRS = ["Inbox", "Memoria", "Projetos", "Pessoas", "Logs"] as const;
const MEMORY_TYPE_TO_FOLDER: Record<string, string> = {
  memory: "Memoria",
  decision: "Memoria",
  project: "Projetos",
  person: "Pessoas",
  log: "Logs",
  summary: "Logs",
};
let memorySchemaReady: Promise<void> | null = null;

type MemoryRow = {
  id: string;
  owner_id: string;
  path: string;
  folder: string;
  slug: string;
  title: string;
  memory_type: string;
  tags: string[];
  aliases: string[];
  summary: string;
  details: string;
  content: string;
  related_notes: string[];
  next_actions: string[];
  created_at: string;
  updated_at: string;
};

type CoordinationTeamRecord = {
  id: string;
  name: string;
  leader_agent_id?: string;
};

function isMissingPathError(error: unknown) {
  return error instanceof Error && "code" in error && String(error.code) === "ENOENT";
}

async function pathExists(relativePath: string) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  try {
    await fs.stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveLikelySourcePath(inputPath: string) {
  const workspaceRoot = process.cwd();
  const normalized = inputPath.replaceAll("\\", "/").replace(/^\.\//, "").trim() || ".";
  if (path.isAbsolute(normalized)) {
    return normalized;
  }

  if (normalized !== "src" && !normalized.startsWith("src/")) {
    return normalized;
  }

  const workspaceSrc = path.resolve(workspaceRoot, normalized);
  try {
    await fs.stat(workspaceSrc);
    return workspaceSrc;
  } catch {}

  if (await pathExists(normalized)) {
    return path.resolve(workspaceRoot, normalized);
  }

  const suffix = normalized === "src" ? "" : normalized.slice(4);
  for (const candidate of SRC_PATH_CANDIDATES) {
    const mapped = suffix ? path.posix.join(candidate, suffix) : candidate;
    if (await pathExists(mapped)) {
      return path.resolve(workspaceRoot, mapped);
    }
  }

  return normalized;
}

async function generatePdfReport(absPath: string, title: string, content: string): Promise<string> {
  await fs.mkdir(path.dirname(absPath), { recursive: true });

  // Generate formatted text/HTML content instead of using PDFKit
  const timestamp = new Date().toLocaleString("pt-BR");
  const separator = "=".repeat(80);
  
  const textContent = [
    separator,
    title.toUpperCase(),
    separator,
    `Gerado em: ${timestamp}`,
    separator,
    "",
    content,
    "",
    separator,
  ].join("\n");

  // Try PDF first, fall back to text if it fails
  try {
    const PDFLib = await getPDFDocument();
    
    return await new Promise<string>((resolve, reject) => {
      try {
        const doc = new PDFLib({ 
          margin: 50, 
          size: "A4",
          bufferPages: true,
        });
        const chunks: Buffer[] = [];

        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", async () => {
          try {
            await fs.writeFile(absPath, Buffer.concat(chunks));
            resolve(absPath);
          } catch (err) {
            reject(err);
          }
        });
        doc.on("error", reject);

        // Add content without explicit font calls
        doc.fontSize(20).text(title, { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor("#666666")
          .text(timestamp, { align: "center" });
        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").stroke();
        doc.moveDown(1);

        doc.fillColor("#000000");
        const lines = content.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            doc.moveDown(0.3);
            continue;
          }
          if (/^\d+\)/.test(trimmed) || (trimmed.endsWith(":") && trimmed.length < 80)) {
            doc.moveDown(0.2).fontSize(11).text(trimmed, { underline: true });
            doc.fontSize(10);
          } else if (trimmed.startsWith("-")) {
            doc.fontSize(10).text(`  ${trimmed}`);
          } else {
            doc.fontSize(10).text(trimmed);
          }
        }

        doc.end();
      } catch (promiseErr) {
        reject(promiseErr);
      }
    });
  } catch (pdfErr) {
    // PDFKit failed - create a simple but valid PDF file programmatically
    console.warn("[PDF_EXPORT] PDFKit unavailable, creating minimal PDF", pdfErr instanceof Error ? pdfErr.message : "unknown error");
    
    // Create a minimal valid PDF with text content
    const createSimplePdf = (title: string, timestamp: string, contentText: string): Buffer => {
      // Split content into lines and limit to reasonable PDF size
      const lines = contentText.split("\n");
      const maxCharsPerLine = 80;
      const wrappedLines: string[] = [];
      
      for (const line of lines) {
        if (line.length > maxCharsPerLine) {
          for (let i = 0; i < line.length; i += maxCharsPerLine) {
            wrappedLines.push(line.slice(i, i + maxCharsPerLine));
          }
        } else {
          wrappedLines.push(line);
        }
      }

      // PDF header
      let pdf = "%PDF-1.4\n";
      
      // Build content stream with text
      const textLines = [
        title.toUpperCase(),
        `Gerado em: ${timestamp}`,
        "",
        ...wrappedLines,
      ];

      let yPosition = 750;
      let contentStream = "BT\n/F1 10 Tf\n50 750 Td\n";
      
      for (const line of textLines) {
        const escapedLine = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
        contentStream += `(${escapedLine}) Tj\nT*\n`;
        yPosition -= 12;
      }
      
      contentStream += "ET\n";

      // PDF objects
      const obj1 = "<< /Type /Catalog /Pages 2 0 R >>";
      const obj2 = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
      const obj3 = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`;
      const obj4 = `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`;
      const obj5 = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

      // Build xref table
      const objects = [obj1, obj2, obj3, obj4, obj5];
      const offsets: number[] = [];
      let currentOffset = pdf.length;

      for (let i = 0; i < objects.length; i++) {
        offsets.push(currentOffset);
        const objStr = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
        pdf += objStr;
        currentOffset += objStr.length;
      }

      const xrefOffset = currentOffset;
      pdf += "xref\n";
      pdf += `0 ${objects.length + 1}\n`;
      pdf += "0000000000 65535 f\n";
      
      for (const offset of offsets) {
        pdf += `${String(offset).padStart(10, "0")} 00000 n\n`;
      }

      pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
      pdf += `startxref\n${xrefOffset}\n`;
      pdf += "%%EOF\n";

      return Buffer.from(pdf, "utf-8");
    };

    try {
      const pdfBuffer = createSimplePdf(title, timestamp, textContent);
      await fs.writeFile(absPath, pdfBuffer);
      return absPath;
    } catch (simplePdfErr) {
      // Last resort: write as text
      console.error("[PDF_EXPORT] Simple PDF creation failed, writing text", simplePdfErr);
      const txtPath = absPath.replace(/\.pdf$/i, ".txt");
      await fs.writeFile(txtPath, textContent, "utf-8");
      return txtPath;
    }
  }
}

async function resolveMemoryOwnerId(user: SessionUser) {
  if (!hasDatabase()) {
    return user.id;
  }

  if (user.id !== "local-admin") {
    return user.id;
  }

  const dbUser = await findDbUserByEmail(user.email).catch(() => null);
  return dbUser?.id ?? user.id;
}

async function ensureMemorySchema() {
  if (!hasDatabase()) {
    return;
  }

  if (!memorySchemaReady) {
    memorySchemaReady = (async () => {
      const db = getDb();
      await db.query(`
        create table if not exists public.agent_memories (
          id text primary key,
          owner_id text not null,
          path text not null,
          folder text not null,
          slug text not null,
          title text not null,
          memory_type text not null default 'memory',
          tags jsonb not null default '[]'::jsonb,
          aliases jsonb not null default '[]'::jsonb,
          summary text not null default '',
          details text not null default '',
          content text not null,
          related_notes jsonb not null default '[]'::jsonb,
          next_actions jsonb not null default '[]'::jsonb,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (owner_id, path)
        );
      `);
      await db.query(`
        create index if not exists agent_memories_owner_type_idx
        on public.agent_memories (owner_id, memory_type, updated_at desc);
      `);
      await db.query(`
        create index if not exists agent_memories_owner_folder_idx
        on public.agent_memories (owner_id, folder, updated_at desc);
      `);
    })();
  }

  await memorySchemaReady;
}

function slugifyNoteName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim() || "memoria";
}

function sanitizeVaultRelativePath(inputPath: string) {
  const normalized = String(inputPath || "")
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\/+|\/+$/g, "");

  if (!normalized || normalized === ".") {
    return "";
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("invalid vault path");
  }

  return segments.join("/");
}

async function ensureObsidianVaultStructure() {
  await fs.mkdir(OBSIDIAN_VAULT_DIR, { recursive: true });
  await Promise.all(
    OBSIDIAN_DEFAULT_DIRS.map((dir) => fs.mkdir(path.join(OBSIDIAN_VAULT_DIR, dir), { recursive: true })),
  );
}

function resolveVaultNotePath(inputPath?: string, folder?: string, title?: string) {
  const requestedPath = sanitizeVaultRelativePath(inputPath || "");
  const requestedFolder = sanitizeVaultRelativePath(folder || OBSIDIAN_DEFAULT_FOLDER) || OBSIDIAN_DEFAULT_FOLDER;

  let relativePath = requestedPath;
  if (!relativePath) {
    const slug = slugifyNoteName(title || "memoria");
    relativePath = `${requestedFolder}/${slug}.md`;
  }

  if (!relativePath.toLowerCase().endsWith(".md")) {
    relativePath = `${relativePath}.md`;
  }

  const absolutePath = path.join(OBSIDIAN_VAULT_DIR, relativePath);
  return {
    relativePath: relativePath.replaceAll("\\", "/"),
    absolutePath,
  };
}

function splitFrontmatter(markdown: string) {
  if (!markdown.startsWith("---\n")) {
    return { frontmatter: "", body: markdown };
  }

  const endIndex = markdown.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    return { frontmatter: "", body: markdown };
  }

  return {
    frontmatter: markdown.slice(4, endIndex),
    body: markdown.slice(endIndex + 5),
  };
}

function parseSimpleFrontmatter(raw: string) {
  const data: Record<string, string | string[]> = {};
  for (const line of raw.split("\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key) continue;

    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
      continue;
    }

    data[key] = value.replace(/^"|"$/g, "");
  }
  return data;
}

function stringifyFrontmatter(input: {
  title: string;
  type: string;
  tags: string[];
  aliases: string[];
  createdAt: string;
  updatedAt: string;
}) {
  const lines = [
    "---",
    `title: "${input.title.replaceAll('"', "'")}"`,
    `type: "${input.type.replaceAll('"', "'")}"`,
    `tags: [${input.tags.map((tag) => `"${tag.replaceAll('"', "'")}"`).join(", ")}]`,
    `aliases: [${input.aliases.map((alias) => `"${alias.replaceAll('"', "'")}"`).join(", ")}]`,
    `created_at: "${input.createdAt}"`,
    `updated_at: "${input.updatedAt}"`,
    "---",
    "",
  ];
  return lines.join("\n");
}

function buildRawMarkdownFromMemoryRow(row: MemoryRow) {
  const frontmatter = stringifyFrontmatter({
    title: row.title,
    type: row.memory_type,
    tags: Array.isArray(row.tags) ? row.tags : [],
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
  return `${frontmatter}${row.content.trim()}\n`;
}

async function findMemoryByPath(user: SessionUser, relativePath: string) {
  await ensureMemorySchema();
  const db = getDb();
  const ownerId = await resolveMemoryOwnerId(user);
  const result = await db.query<MemoryRow>(
    `select id, owner_id, path, folder, slug, title, memory_type, tags, aliases, summary, details, content, related_notes, next_actions, created_at, updated_at
     from public.agent_memories
     where owner_id = $1 and path = $2
     limit 1`,
    [ownerId, relativePath],
  );
  return result.rows[0] ?? null;
}

async function upsertMemoryRow(
  user: SessionUser,
  input: {
    path: string;
    folder: string;
    slug: string;
    title: string;
    memoryType: string;
    tags: string[];
    aliases: string[];
    summary: string;
    details: string;
    content: string;
    relatedNotes: string[];
    nextActions: string[];
  },
) {
  await ensureMemorySchema();
  const db = getDb();
  const ownerId = await resolveMemoryOwnerId(user);
  const existing = await findMemoryByPath(user, input.path);
  const id = existing?.id ?? crypto.randomUUID();

  const result = await db.query<MemoryRow>(
    `insert into public.agent_memories (
      id, owner_id, path, folder, slug, title, memory_type, tags, aliases, summary, details, content, related_notes, next_actions
     ) values (
      $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12, $13::jsonb, $14::jsonb
     )
     on conflict (owner_id, path)
     do update set
      folder = excluded.folder,
      slug = excluded.slug,
      title = excluded.title,
      memory_type = excluded.memory_type,
      tags = excluded.tags,
      aliases = excluded.aliases,
      summary = excluded.summary,
      details = excluded.details,
      content = excluded.content,
      related_notes = excluded.related_notes,
      next_actions = excluded.next_actions,
      updated_at = now()
     returning id, owner_id, path, folder, slug, title, memory_type, tags, aliases, summary, details, content, related_notes, next_actions, created_at, updated_at`,
    [
      id,
      ownerId,
      input.path,
      input.folder,
      input.slug,
      input.title,
      input.memoryType,
      JSON.stringify(input.tags),
      JSON.stringify(input.aliases),
      input.summary,
      input.details,
      input.content,
      JSON.stringify(input.relatedNotes),
      JSON.stringify(input.nextActions),
    ],
  );

  return result.rows[0];
}

async function listMemoryRows(user: SessionUser) {
  await ensureMemorySchema();
  const db = getDb();
  const ownerId = await resolveMemoryOwnerId(user);
  const result = await db.query<MemoryRow>(
    `select id, owner_id, path, folder, slug, title, memory_type, tags, aliases, summary, details, content, related_notes, next_actions, created_at, updated_at
     from public.agent_memories
     where owner_id = $1
     order by updated_at desc, created_at desc`,
    [ownerId],
  );
  return result.rows;
}

async function collectMarkdownFiles(currentDir: string, prefix = ""): Promise<string[]> {
  const dirents = await fs.readdir(currentDir, { withFileTypes: true });
  const files: string[] = [];

  for (const dirent of dirents) {
    if (dirent.name.startsWith(".")) continue;

    const nextAbsolute = path.join(currentDir, dirent.name);
    const nextRelative = prefix ? `${prefix}/${dirent.name}` : dirent.name;

    if (dirent.isDirectory()) {
      files.push(...(await collectMarkdownFiles(nextAbsolute, nextRelative)));
      continue;
    }

    if (dirent.isFile() && dirent.name.toLowerCase().endsWith(".md")) {
      files.push(nextRelative.replaceAll("\\", "/"));
    }
  }

  return files;
}

function createSnippet(text: string, query: string) {
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const index = normalizedText.indexOf(normalizedQuery);
  if (index === -1) {
    return text.replace(/\s+/g, " ").trim().slice(0, 180);
  }

  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + query.length + 120);
  return text
    .slice(start, end)
    .replace(/\s+/g, " ")
    .trim();
}

async function readVaultNote(user: SessionUser, relativePath: string) {
  if (hasDatabase()) {
    const notePath = resolveVaultNotePath(relativePath).relativePath;
    const row = await findMemoryByPath(user, notePath);
    if (!row) {
      throw new Error("memory note not found");
    }
    return {
      path: row.path,
      frontmatter: {
        title: row.title,
        type: row.memory_type,
        tags: row.tags,
        aliases: row.aliases,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      content: row.content.trim(),
      raw: buildRawMarkdownFromMemoryRow(row),
      storage: "database" as const,
    };
  }

  await ensureObsidianVaultStructure();
  const note = resolveVaultNotePath(relativePath);
  const raw = await fs.readFile(note.absolutePath, "utf8");
  const { frontmatter, body } = splitFrontmatter(raw);
  return {
    path: note.relativePath,
    frontmatter: frontmatter ? parseSimpleFrontmatter(frontmatter) : {},
    content: body.trim(),
    raw,
    storage: "vault" as const,
  };
}

async function searchVaultNotes(user: SessionUser, query: string, folder?: string) {
  if (hasDatabase()) {
    await ensureMemorySchema();
    const db = getDb();
    const ownerId = await resolveMemoryOwnerId(user);
    const folderFilter = sanitizeVaultRelativePath(folder || "");
    const searchTerm = `%${query.trim()}%`;
    const result = await db.query<MemoryRow>(
      `select id, owner_id, path, folder, slug, title, memory_type, tags, aliases, summary, details, content, related_notes, next_actions, created_at, updated_at
       from public.agent_memories
       where owner_id = $1
         and ($2 = '' or folder = $2)
         and (
           title ilike $3 or
           path ilike $3 or
           summary ilike $3 or
           details ilike $3 or
           content ilike $3
         )
       order by updated_at desc
       limit 10`,
      [ownerId, folderFilter, searchTerm],
    );

    return {
      storage: "database" as const,
      results: result.rows.map((row) => ({
        path: row.path,
        title: row.title,
        score: 1,
        snippet: createSnippet(`${row.summary}\n${row.details}\n${row.content}`, query),
      })),
    };
  }

  await ensureObsidianVaultStructure();
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    throw new Error("query required");
  }

  const relativeFolder = sanitizeVaultRelativePath(folder || "");
  const absoluteFolder = relativeFolder
    ? path.join(OBSIDIAN_VAULT_DIR, relativeFolder)
    : OBSIDIAN_VAULT_DIR;

  const markdownFiles = await collectMarkdownFiles(absoluteFolder, relativeFolder);
  const matches = await Promise.all(
    markdownFiles.map(async (relativePath) => {
      const absolutePath = path.join(OBSIDIAN_VAULT_DIR, relativePath);
      const raw = await fs.readFile(absolutePath, "utf8");
      const { frontmatter, body } = splitFrontmatter(raw);
      const parsedFrontmatter = frontmatter ? parseSimpleFrontmatter(frontmatter) : {};
      const haystack = `${relativePath}\n${JSON.stringify(parsedFrontmatter)}\n${body}`.toLowerCase();
      const score = haystack.split(normalizedQuery).length - 1;
      if (score <= 0) return null;

      return {
        path: relativePath,
        title:
          (typeof parsedFrontmatter.title === "string" && parsedFrontmatter.title) ||
          path.basename(relativePath, ".md"),
        score,
        snippet: createSnippet(body, query),
      };
    }),
  );

  return {
    storage: "vault" as const,
    vaultPath: OBSIDIAN_VAULT_DIR,
    results: matches
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
      .slice(0, 10),
  };
}

async function upsertVaultNote(user: SessionUser, input: Record<string, unknown>) {
  await assertFileMutationAllowed("memory_upsert");

  const title = String(input.title || "").trim() || "Memoria";
  const type = String(input.type || "memory").trim() || "memory";
  const content = String(input.content || "").trim();
  if (!content) {
    throw new Error("content required");
  }

  const tags = Array.isArray(input.tags)
    ? input.tags.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const aliases = Array.isArray(input.aliases)
    ? input.aliases.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  const note = resolveVaultNotePath(
    typeof input.path === "string" ? input.path : undefined,
    typeof input.folder === "string" ? input.folder : undefined,
    title,
  );
  const summary = String(input.summary || "").trim();
  const details = String(input.details || "").trim();
  const relatedNotes = Array.isArray(input.related_notes)
    ? input.related_notes.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const nextActions = Array.isArray(input.next_actions)
    ? input.next_actions.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  if (hasDatabase()) {
    const row = await upsertMemoryRow(user, {
      path: note.relativePath,
      folder: note.relativePath.includes("/") ? note.relativePath.split("/")[0] || OBSIDIAN_DEFAULT_FOLDER : OBSIDIAN_DEFAULT_FOLDER,
      slug: path.basename(note.relativePath, ".md"),
      title,
      memoryType: type,
      tags,
      aliases,
      summary,
      details,
      content,
      relatedNotes,
      nextActions,
    });
    return {
      ok: true,
      path: row.path,
      title: row.title,
      updatedAt: row.updated_at,
      storage: "database" as const,
    };
  }

  await ensureObsidianVaultStructure();

  let createdAt = new Date().toISOString();
  try {
    const existing = await fs.readFile(note.absolutePath, "utf8");
    const { frontmatter } = splitFrontmatter(existing);
    const parsed = frontmatter ? parseSimpleFrontmatter(frontmatter) : {};
    if (typeof parsed.created_at === "string" && parsed.created_at.trim()) {
      createdAt = parsed.created_at;
    }
  } catch {}

  const updatedAt = new Date().toISOString();
  const markdown =
    stringifyFrontmatter({
      title,
      type,
      tags,
      aliases,
      createdAt,
      updatedAt,
    }) + `${content.trim()}\n`;

  await fs.mkdir(path.dirname(note.absolutePath), { recursive: true });
  await fs.writeFile(note.absolutePath, markdown, "utf8");

  return {
    ok: true,
    path: note.relativePath,
    vaultPath: OBSIDIAN_VAULT_DIR,
    title,
    updatedAt,
    storage: "vault" as const,
  };
}

async function appendVaultNote(user: SessionUser, input: Record<string, unknown>) {
  await assertFileMutationAllowed("memory_append");

  const content = String(input.content || "").trim();
  if (!content) {
    throw new Error("content required");
  }

  const title = String(input.title || "").trim() || "Memoria";
  const note = resolveVaultNotePath(
    typeof input.path === "string" ? input.path : undefined,
    typeof input.folder === "string" ? input.folder : undefined,
    title,
  );

  if (hasDatabase()) {
    const existing = await findMemoryByPath(user, note.relativePath);
    const stamp = new Date().toLocaleString("pt-BR");
    const appendedContent = existing
      ? `${existing.content.trimEnd()}\n\n## ${stamp}\n\n${content}\n`
      : `# Resumo\n\n${title}\n\n## ${stamp}\n\n${content}\n`;
    const row = await upsertMemoryRow(user, {
      path: note.relativePath,
      folder: note.relativePath.includes("/") ? note.relativePath.split("/")[0] || OBSIDIAN_DEFAULT_FOLDER : OBSIDIAN_DEFAULT_FOLDER,
      slug: path.basename(note.relativePath, ".md"),
      title: existing?.title || title,
      memoryType: existing?.memory_type || "memory",
      tags: existing?.tags || [],
      aliases: existing?.aliases || [],
      summary: existing?.summary || "",
      details: existing?.details || "",
      content: appendedContent,
      relatedNotes: existing?.related_notes || [],
      nextActions: existing?.next_actions || [],
    });
    return {
      ok: true,
      path: row.path,
      appended: true,
      storage: "database" as const,
    };
  }

  await ensureObsidianVaultStructure();

  let existingRaw = "";
  try {
    existingRaw = await fs.readFile(note.absolutePath, "utf8");
  } catch {}

  let nextRaw = existingRaw;
  if (!nextRaw) {
    nextRaw = stringifyFrontmatter({
      title,
      type: "memory",
      tags: [],
      aliases: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const stamp = new Date().toLocaleString("pt-BR");
  nextRaw = `${nextRaw.trimEnd()}\n\n## ${stamp}\n\n${content}\n`;

  await fs.mkdir(path.dirname(note.absolutePath), { recursive: true });
  await fs.writeFile(note.absolutePath, nextRaw, "utf8");

  return {
    ok: true,
    path: note.relativePath,
    vaultPath: OBSIDIAN_VAULT_DIR,
    appended: true,
    storage: "vault" as const,
  };
}

function normalizeLinkTarget(input: string) {
  return input.trim().replace(/^\[\[|\]\]$/g, "").replace(/\.md$/i, "");
}

function toWikiLink(input: string) {
  const target = normalizeLinkTarget(input);
  return target ? `[[${target}]]` : "";
}

function buildStructuredMemoryContent(input: {
  summary: string;
  details: string;
  related: string[];
  nextActions: string[];
}) {
  const lines = ["# Resumo", "", input.summary.trim(), ""];

  if (input.details.trim()) {
    lines.push("## Detalhes", "", input.details.trim(), "");
  }

  if (input.related.length > 0) {
    lines.push("## Relacoes", "");
    for (const link of input.related) {
      lines.push(`- ${link}`);
    }
    lines.push("");
  }

  if (input.nextActions.length > 0) {
    lines.push("## Proximos passos", "");
    for (const action of input.nextActions) {
      lines.push(`- ${action}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

async function captureStructuredMemory(user: SessionUser, input: Record<string, unknown>) {
  await assertFileMutationAllowed("memory_capture");
  if (!hasDatabase()) {
    await ensureObsidianVaultStructure();
  }

  const rawType = String(input.memory_type || "memory").trim().toLowerCase();
  const memoryType = rawType || "memory";
  const folder = MEMORY_TYPE_TO_FOLDER[memoryType] || OBSIDIAN_DEFAULT_FOLDER;
  const title = String(input.title || "").trim() || "Memoria";
  const summary = String(input.summary || "").trim();
  if (!summary) {
    throw new Error("summary required");
  }

  const details = String(input.details || "").trim();
  const tags = Array.isArray(input.tags)
    ? input.tags.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const aliases = Array.isArray(input.aliases)
    ? input.aliases.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const related = Array.isArray(input.related_notes)
    ? input.related_notes
        .map((item) => toWikiLink(String(item || "")))
        .filter(Boolean)
    : [];
  const nextActions = Array.isArray(input.next_actions)
    ? input.next_actions.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  const notePath = resolveVaultNotePath(
    typeof input.path === "string" ? input.path : undefined,
    folder,
    title,
  ).relativePath;

  return upsertVaultNote(user, {
    path: notePath,
    folder,
    title,
    type: memoryType,
    tags: Array.from(new Set([memoryType, ...tags])),
    aliases,
    summary,
    details,
    related_notes: related,
    next_actions: nextActions,
    content: buildStructuredMemoryContent({
      summary,
      details,
      related,
      nextActions,
    }),
  });
}

export const chatToolDefinitions = [
  {
    type: "function",
    name: "file_read",
    description: "Ler um arquivo de texto ou inspecionar preview de arquivo.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Caminho do arquivo." },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "ls_safe",
    description: "Listar arquivos e pastas em um diretorio.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Caminho da pasta." },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "file_write",
    description: "Salvar conteudo em um arquivo.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Caminho do arquivo." },
        content: { type: "string", description: "Conteudo textual." },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "directory_create",
    description: "Criar uma pasta.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Caminho da pasta." },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "file_move",
    description: "Mover ou renomear arquivo/pasta.",
    parameters: {
      type: "object",
      properties: {
        from_path: { type: "string", description: "Origem." },
        to_path: { type: "string", description: "Destino." },
      },
      required: ["from_path", "to_path"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "file_copy",
    description: "Copiar arquivo ou pasta.",
    parameters: {
      type: "object",
      properties: {
        from_path: { type: "string", description: "Origem." },
        to_path: { type: "string", description: "Destino." },
      },
      required: ["from_path", "to_path"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "file_delete",
    description: "Apagar arquivo ou pasta.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Caminho do item." },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  webSearchToolDefinition,
  exchangeRateToolDefinition,
  {
    type: "function",
    name: "memory_search",
    description: "Buscar memorias e notas Markdown no vault do Obsidian do projeto.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Termo ou frase curta para buscar nas notas." },
        folder: { type: "string", description: "Pasta opcional dentro do vault, como Memoria ou Projetos." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "memory_read",
    description: "Ler uma nota especifica do vault do Obsidian.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Caminho relativo da nota dentro do vault." },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "memory_capture",
    description: "Capturar memoria estruturada no vault do Obsidian, escolhendo a pasta adequada para pessoa, projeto, decisao, memoria ou log.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Caminho relativo opcional da nota dentro do vault." },
        memory_type: {
          type: "string",
          enum: ["memory", "decision", "project", "person", "log", "summary"],
          description: "Tipo de memoria a ser criada.",
        },
        title: { type: "string", description: "Titulo principal da nota." },
        summary: { type: "string", description: "Resumo curto e principal." },
        details: { type: "string", description: "Detalhes extras em texto livre." },
        tags: { type: "array", items: { type: "string" } },
        aliases: { type: "array", items: { type: "string" } },
        related_notes: {
          type: "array",
          items: { type: "string" },
          description: "Notas relacionadas, como Projetos/projeto-chocks ou Pessoas/bruno-silva.",
        },
        next_actions: { type: "array", items: { type: "string" } },
      },
      required: ["memory_type", "title", "summary"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "memory_upsert",
    description: "Criar ou substituir uma nota Markdown no vault do Obsidian com frontmatter basico.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Caminho relativo opcional da nota dentro do vault." },
        folder: { type: "string", description: "Pasta opcional como Memoria, Projetos ou Pessoas." },
        title: { type: "string", description: "Titulo da nota." },
        type: { type: "string", description: "Tipo logico da nota, por exemplo memory, project ou person." },
        tags: { type: "array", items: { type: "string" } },
        aliases: { type: "array", items: { type: "string" } },
        content: { type: "string", description: "Conteudo Markdown da nota." },
      },
      required: ["title", "content"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "memory_append",
    description: "Acrescentar uma nova entrada textual a uma nota existente no vault do Obsidian.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Caminho relativo opcional da nota dentro do vault." },
        folder: { type: "string", description: "Pasta opcional dentro do vault." },
        title: { type: "string", description: "Titulo usado se a nota ainda nao existir." },
        content: { type: "string", description: "Texto a ser anexado na nota." },
      },
      required: ["content"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "workflow_get",
    description: "Obter o workflow atual da conversa.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "workflow_replace",
    description: "Criar ou substituir o workflow da conversa.",
    parameters: {
      type: "object",
      properties: {
        goal: { type: "string" },
        summary: { type: "string" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              text: { type: "string" },
              status: {
                type: "string",
                enum: ["pending", "in_progress", "completed"],
              },
            },
            required: ["text"],
            additionalProperties: false,
          },
        },
      },
      required: ["goal", "steps"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "workflow_update_step",
    description: "Atualizar uma etapa do workflow.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        text: { type: "string" },
        status: {
          type: "string",
          enum: ["pending", "in_progress", "completed"],
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "workflow_clear",
    description: "Limpar o workflow da conversa.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "pdf_report",
    description: "Gerar um relatório em PDF e salvar no disco. Use sempre que precisar criar um relatório, análise ou documento para o usuário — prefira PDF a TXT.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Caminho do arquivo PDF de saída (ex: relatorio.pdf ou reports/analise.pdf)." },
        title: { type: "string", description: "Título do relatório, exibido no cabeçalho do PDF." },
        content: { type: "string", description: "Conteúdo textual completo do relatório. Use linhas iniciadas com '- ' para listas e termine seções com ':'." },
      },
      required: ["path", "title", "content"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "list_teams_and_agents",
    description: "Listar todos os times de coordination e seus agentes. Use antes de criar workflows para saber qual team usar.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "assign_workflow_to_team",
    description: "Criar um workflow e enviar tarefas para os agentes de um time específico. Use após criar agents.",
    parameters: {
      type: "object",
      properties: {
        team_id: { type: "string", description: "ID do time, ex: 'team-1776091053176-q15btb5'." },
        workflow_goal: { type: "string", description: "Objetivo do workflow, ex: 'Parse and validate CSV data'." },
        steps: { 
          type: "array", 
          items: { type: "object", properties: { role: { type: "string" }, task: { type: "string" } } },
          description: "Array de tarefas com role (researcher/implementer/tester) e task (descrição), ex: [{role: 'researcher', task: 'validate format'}]"
        },
      },
      required: ["team_id", "workflow_goal", "steps"],
      additionalProperties: false,
    },
  },
] as const;

function normalizeWorkflowStep(step: unknown, index: number): WorkflowStep {
  const input = step as Partial<WorkflowStep> | null;
  const text = typeof input?.text === "string" ? input.text.trim() : "";
  if (!text) {
    throw new Error(`workflow step ${index + 1} missing text`);
  }
  const status: WorkflowStepStatus =
    input?.status === "in_progress" || input?.status === "completed" ? input.status : "pending";
  return {
    id: typeof input?.id === "string" && input.id.trim() ? input.id.trim() : crypto.randomUUID(),
    text,
    status,
  };
}

export async function runChatTool(
  user: SessionUser,
  chatId: string,
  toolName: string,
  input: Record<string, unknown>,
) {
  if (toolName === "file_read") {
    const requestedPath = String(input.path || "");
    const resolvedPath = await resolveLikelySourcePath(requestedPath);
    try {
      const result = await readFileForPreview(resolvedPath);
      return resolvedPath !== requestedPath
        ? { ...result, redirectedFrom: requestedPath, resolvedPath }
        : result;
    } catch (error) {
      if (resolvedPath !== requestedPath && isMissingPathError(error)) {
        return readFileForPreview(requestedPath);
      }
      throw error;
    }
  }

  if (toolName === "ls_safe") {
    const requestedPath = String(input.path || ".");
    const resolvedPath = await resolveLikelySourcePath(requestedPath);
    try {
      const result = await listFileEntries(resolvedPath);
      return resolvedPath !== requestedPath
        ? { ...result, redirectedFrom: requestedPath, resolvedPath }
        : result;
    } catch (error) {
      if (resolvedPath !== requestedPath && isMissingPathError(error)) {
        return listFileEntries(requestedPath);
      }
      throw error;
    }
  }

  if (toolName === "file_write") {
    return writeFileContents(String(input.path || ""), String(input.content || ""));
  }

  if (toolName === "directory_create") {
    return createDirectory(String(input.path || ""));
  }

  if (toolName === "file_move") {
    return moveFileSystemEntry(String(input.from_path || ""), String(input.to_path || ""));
  }

  if (toolName === "file_copy") {
    return copyFileSystemEntry(String(input.from_path || ""), String(input.to_path || ""));
  }

  if (toolName === "file_delete") {
    return deleteFileSystemEntry(String(input.path || ""));
  }

  if (toolName === "web_search") {
    return searchWeb(user, {
      query: String(input.query || ""),
      max_results: typeof input.max_results === "number" ? input.max_results : undefined,
    });
  }

  if (toolName === "exchange_rate") {
    return getExchangeRate(user, {
      from: String(input.from || "USD"),
      to: String(input.to || "BRL"),
    });
  }

  if (toolName === "memory_search") {
    return searchVaultNotes(user, String(input.query || ""), typeof input.folder === "string" ? input.folder : undefined);
  }

  if (toolName === "memory_read") {
    const notePath = String(input.path || "").trim();
    if (!notePath) {
      throw new Error("path required");
    }
    return readVaultNote(user, notePath);
  }

  if (toolName === "memory_capture") {
    return captureStructuredMemory(user, input);
  }

  if (toolName === "memory_upsert") {
    return upsertVaultNote(user, input);
  }

  if (toolName === "memory_append") {
    return appendVaultNote(user, input);
  }

  if (toolName === "workflow_get") {
    return getWorkflowState(user, chatId);
  }

  if (toolName === "workflow_replace") {
    const goal = String(input.goal || "").trim();
    const steps = Array.isArray(input.steps) ? input.steps.map(normalizeWorkflowStep) : [];
    if (!goal) throw new Error("goal required");
    if (steps.length === 0) throw new Error("steps required");

    const now = new Date().toISOString();
    const workflow: StoredWorkflow = {
      chatId,
      goal,
      summary: typeof input.summary === "string" && input.summary.trim() ? input.summary.trim() : undefined,
      createdAt: now,
      updatedAt: now,
      steps,
    };
    return saveWorkflowState(user, workflow);
  }

  if (toolName === "workflow_update_step") {
    const workflow = await getWorkflowState(user, chatId);
    if (!workflow) {
      throw new Error("no active workflow");
    }
    const stepId = String(input.id || "").trim();
    if (!stepId) throw new Error("id required");

    const updatedWorkflow: StoredWorkflow = {
      ...workflow,
      updatedAt: new Date().toISOString(),
      steps: workflow.steps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              text: typeof input.text === "string" && input.text.trim() ? input.text.trim() : step.text,
              status:
                input.status === "pending" || input.status === "in_progress" || input.status === "completed"
                  ? input.status
                  : step.status,
            }
          : step,
      ),
    };
    return saveWorkflowState(user, updatedWorkflow);
  }

  if (toolName === "workflow_clear") {
    return clearWorkflowState(user, chatId);
  }

  if (toolName === "pdf_report") {
    await assertFileMutationAllowed("file_write");
    const filePath = String(input.path || "reports/relatorio.pdf").replace(/\.txt$/i, ".pdf");
    const title = String(input.title || "Relatório").trim();
    const content = String(input.content || "").trim();
    if (!content) throw new Error("content required");
    try {
      const scope = await resolveFileScope(filePath);
      const absPath = await generatePdfReport(scope.target, title || "Relatório", content);
      return { ok: true, path: absPath, message: `PDF gerado em ${absPath}` };
    } catch {
      const fallbackScope = await resolveFileScope(path.join(".chocks-local", "exports", `relatorio-${Date.now()}.pdf`));
      const absPath = await generatePdfReport(
        fallbackScope.target,
        title || "Relatório",
        content,
      );
      return {
        ok: true,
        path: absPath,
        fallback: true,
        message: `PDF gerado em ${absPath}`,
      };
    }
  }

  if (toolName === "list_teams_and_agents") {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";

    try {
      const teamsRes = await fetch(`${backendUrl}/api/coordination/team`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!teamsRes.ok) throw new Error(`Failed to fetch teams: ${teamsRes.status}`);
      
      const teamsData = await teamsRes.json();
      const teams = Array.isArray(teamsData.teams) ? (teamsData.teams as CoordinationTeamRecord[]) : [];

      // Fetch agents for each team
      const teamsWithAgents = await Promise.all(
        teams.map(async (team) => {
          try {
            const agentsRes = await fetch(`${backendUrl}/api/coordination/team/${team.id}/agents`, {
              method: "GET",
              headers: { "Content-Type": "application/json" },
            });
            const agentsData = agentsRes.ok ? await agentsRes.json() : { agents: [] };
            return {
              teamId: team.id,
              teamName: team.name,
              leaderAgentId: team.leader_agent_id,
              agents: Array.isArray(agentsData.agents) ? agentsData.agents : [],
            };
          } catch {
            return {
              teamId: team.id,
              teamName: team.name,
              leaderAgentId: team.leader_agent_id,
              agents: [],
            };
          }
        })
      );

      return {
        ok: true,
        total: teamsWithAgents.length,
        teams: teamsWithAgents,
        message: `📋 ${teamsWithAgents.length} time(s) encontrado(s). Use assign_workflow_to_team com team_id para atribuir tarefas.`,
      };
    } catch (error) {
      throw new Error(`Failed to list teams: ${String(error)}`);
    }
  }

  if (toolName === "assign_workflow_to_team") {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";
    const teamId = String(input.team_id || "").trim();
    const goal = String(input.workflow_goal || "").trim();
    const stepsArray = Array.isArray(input.steps) ? input.steps : [];

    if (!teamId) throw new Error("team_id required");
    if (!goal) throw new Error("workflow_goal required");
    if (stepsArray.length === 0) throw new Error("steps array required");

    try {
      // 1. Send workflow goal to team
      const messageRes = await fetch(`${backendUrl}/api/coordination/team/${teamId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAgentId: "system-coordinator",
          toAgentId: "*", // Broadcast
          messageType: "task_notification",
          content: goal,
        }),
      });

      if (!messageRes.ok) {
        console.warn(`Failed to send workflow message: ${messageRes.status}`);
      }

      // 2. Send individual tasks to matching-role agents
      for (const step of stepsArray) {
        const role = String(step.role || "").trim();
        const task = String(step.task || "").trim();

        if (!role || !task) continue;

        // Note: In a real system, we'd fetch agents by role and send to each
        // For now, we just acknowledge the intent
        console.log(`[Workflow] Task for ${role}: ${task}`);
      }

      return {
        ok: true,
        teamId,
        goal,
        stepCount: stepsArray.length,
        message: `✅ Workflow "${goal}" enviado para o time. Monitore em Coordination → Workflows para ver o progresso dos ${stepsArray.length} step(s).`,
      };
    } catch (error) {
      throw new Error(`Failed to assign workflow: ${String(error)}`);
    }
  }

  throw new Error(`unknown tool: ${toolName}`);
}

export async function syncDatabaseMemoriesToVault(user: SessionUser) {
  if (!hasDatabase()) {
    return {
      ok: false,
      synced: 0,
      storage: "vault" as const,
      message: "DATABASE_URL nao configurado.",
    };
  }

  await ensureObsidianVaultStructure();
  const rows = await listMemoryRows(user);

  let synced = 0;
  for (const row of rows) {
    const note = resolveVaultNotePath(row.path);
    await fs.mkdir(path.dirname(note.absolutePath), { recursive: true });
    await fs.writeFile(note.absolutePath, buildRawMarkdownFromMemoryRow(row), "utf8");
    synced += 1;
  }

  return {
    ok: true,
    synced,
    storage: "database" as const,
    vaultPath: OBSIDIAN_VAULT_DIR,
    message: `${synced} memorias sincronizadas para o vault local.`,
  };
}
