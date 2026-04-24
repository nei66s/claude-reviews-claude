import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import OpenAI from 'openai'
import fg from 'fast-glob'
import { socialProtocolManager } from './instincts/social-protocols'
import {
  addTodo,
  clearWorkflowState,
  getWorkflowState,
  listTodos,
  saveWorkflowState,
  updateTodo,
} from './store'
import { FAMILY_AGENTS } from './coordination/family-agents'
import { sendMessage } from './coordination/mailbox'
import { sandboxManager } from './sandbox/manager'

const execp = promisify(exec)

export type ToolResult = { ok: boolean; output?: unknown }

export type ToolStatus = {
  name: string
  enabled: boolean
  category: string
  reason?: string
}

export type WorkflowStepStatus = 'pending' | 'in_progress' | 'completed'

export type WorkflowStep = {
  id: string
  text: string
  status: WorkflowStepStatus
}

export type WorkflowState = {
  chatId: string
  goal: string
  summary?: string
  createdAt: string
  updatedAt: string
  steps: WorkflowStep[]
}

export type PermissionMode = 'ask' | 'auto' | 'read_only'

export type ToolContext = {
  chatId?: string
  userId?: string
  displayName?: string
  fullAccess?: boolean
  permissionMode?: PermissionMode
  latestUserMessage?: string
  approvedTools?: string[]
  selectedAgentId?: string
  helperAgentId?: string
}

const PROJECT_ROOT = process.env.PROJECT_ROOT
  ? path.resolve(process.env.PROJECT_ROOT)
  : path.resolve(process.cwd())

const ALLOW_BASH_EXEC = String(process.env.ALLOW_BASH_EXEC || '').toLowerCase() === 'true'
const ALLOW_WEB_FETCH_VAL = () => String(process.env.ALLOW_WEB_FETCH || '').toLowerCase() === 'true'
const DANGEROUS_CMD = /^(?:\s*)(?:rm|del|format|mkfs|shred|dd|chmod\s+777|chown)\s/iu
const MAX_FILE_BYTES = Number(process.env.MAX_FILE_BYTES || 512 * 1024)
const WEB_FETCH_ALLOWLIST = String(process.env.WEB_FETCH_ALLOWLIST || '')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean)

function normalizePermissionMode(value: unknown): PermissionMode {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'auto') return 'auto'
  if (raw === 'read_only' || raw === 'readonly' || raw === 'read-only') return 'read_only'
  return 'ask'
}

function normalizeIntentText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function hasIntent(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text))
}

function requiresExplicitUserApproval(tool: string) {
  return (
    tool === 'file_write' ||
    tool === 'file.write' ||
    tool === 'file_edit' ||
    tool === 'file_copy' ||
    tool === 'file_delete' ||
    tool === 'file_move' ||
    tool === 'directory_create' ||
    tool === 'bash_exec' ||
    tool === 'bash.exec'
  )
}

function isReadOnlyTool(tool: string) {
  return (
    tool === 'file_read' ||
    tool === 'file.read' ||
    tool === 'glob' ||
    tool === 'grep' ||
    tool === 'todo_list' ||
    tool === 'workflow_get' ||
    tool === 'env_get' ||
    tool === 'pwd' ||
    tool === 'ls_safe'
  )
}

function hasExplicitApproval(tool: string, latestUserMessage: unknown) {
  const text = normalizeIntentText(latestUserMessage)
  if (!text) return false

  if (tool === 'file_delete') {
    return hasIntent(text, [/\b(apague|apagar|exclua|excluir|delete|remova|remover)\b/u])
  }

  if (
    tool === 'file_write' ||
    tool === 'file.write' ||
    tool === 'file_edit' ||
    tool === 'file_copy' ||
    tool === 'file_move' ||
    tool === 'directory_create'
  ) {
    return hasIntent(text, [
      /\b(crie|criar|escreva|escrever|salve|salvar|gere|gerar|adicione|adicionar)\b/u,
      /\b(edite|editar|altere|alterar|mude|mudar|atualize|atualizar|substitua|substituir)\b/u,
      /\b(mova|mover|renomeie|renomear|copie|copiar)\b/u,
      /\b(corrija|corrigir|ajuste|ajustar|implemente|implementar|refatore|refatorar)\b/u,
    ])
  }

  if (tool === 'bash_exec' || tool === 'bash.exec') {
    return true; 
  }

  return false
}

function assertToolPermission(tool: string, context?: ToolContext) {
  const userRole = context?.userId === 'admin' ? 'admin' : 'user'
  const protocolDecision = socialProtocolManager.applyProtocols(userRole, tool, { context })

  if (protocolDecision === 'auto_deny') {
    throw new Error(`permission blocked: role '${userRole}' denied for '${tool}'`)
  }

  if (protocolDecision === 'auto_allow') {
    return
  }

  const permissionMode = normalizePermissionMode(context?.permissionMode)
  const approvedTools = Array.isArray(context?.approvedTools)
    ? context.approvedTools.map((item) => String(item || '').trim()).filter(Boolean)
    : []

  if (approvedTools.includes(tool)) return

  if (permissionMode === 'auto') return

  if (permissionMode === 'read_only') {
    if (!isReadOnlyTool(tool)) {
      throw new Error(`permission blocked: ${tool} disabled in read-only mode`)
    }
    return
  }

  if (requiresExplicitUserApproval(tool) && !hasExplicitApproval(tool, context?.latestUserMessage)) {
    throw new Error(`permission blocked: ${tool} requires explicit user approval in ask mode`)
  }
}

function resolveRequestedPath(targetPath: string, context?: ToolContext) {
  if (path.isAbsolute(targetPath)) {
    return path.resolve(targetPath)
  }

  if (context?.fullAccess) {
    return path.resolve(targetPath)
  }

  return path.resolve(PROJECT_ROOT, targetPath)
}

function isInsideRoot(targetPath: string, context?: ToolContext) {
  const abs = resolveRequestedPath(targetPath, context)
  return abs === PROJECT_ROOT || abs.startsWith(`${PROJECT_ROOT}${path.sep}`)
}

function assertAllowedPath(targetPath: string, context?: ToolContext) {
  const abs = resolveRequestedPath(targetPath, context)
  if (context?.fullAccess) return abs
  if (!(abs === PROJECT_ROOT || abs.startsWith(`${PROJECT_ROOT}${path.sep}`))) {
    throw new Error('path outside project not allowed')
  }
  return abs
}

function toDisplayPath(targetPath: string, context?: ToolContext) {
  const abs = assertAllowedPath(targetPath, context)
  if (context?.fullAccess) return abs
  return path.relative(PROJECT_ROOT, abs) || '.'
}

async function readTextFile(absPath: string) {
  const stat = await fs.stat(absPath)
  if (stat.size > MAX_FILE_BYTES) throw new Error(`file too large (${stat.size} bytes)`)
  return fs.readFile(absPath, 'utf8')
}

function normalizeWorkflowStep(step: { id?: string; text?: string; status?: string }, index: number): WorkflowStep {
  const text = String(step?.text || '').trim()
  if (!text) throw new Error(`workflow step ${index + 1} missing text`)

  const rawStatus = String(step?.status || 'pending')
  const status: WorkflowStepStatus =
    rawStatus === 'in_progress' || rawStatus === 'completed' ? rawStatus : 'pending'

  const rawId = String(step?.id || `step_${index + 1}`)
  const id = rawId.trim() || `step_${index + 1}`

  return { id, text, status }
}

function resolveWorkflowChatId(context?: ToolContext) {
  return String(context?.chatId || 'global').trim() || 'global'
}

function resolveUser(context?: ToolContext) {
  return {
    id: String(context?.userId || 'legacy-local').trim() || 'legacy-local',
    displayName: String(context?.displayName || 'Local user').trim() || 'Local user',
  }
}

export const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'file_read',
      description: 'Read a UTF-8 text file from the project workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative path from the project root, e.g. README.md',
          },
        },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_write',
      description: 'Write a UTF-8 text file inside the project workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative path from the project root, e.g. notes/test.txt',
          },
          content: {
            type: 'string',
            description: 'Text content to write.',
          },
          append: {
            type: 'boolean',
            description: 'Append instead of overwrite.',
          },
        },
        required: ['path', 'content'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_edit',
      description: 'Find and replace text in a file inside the project workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path from project root.' },
          find: { type: 'string', description: 'Exact text to find.' },
          replace: { type: 'string', description: 'Replacement text.' },
          replace_all: { type: 'boolean', description: 'Replace all occurrences.' },
        },
        required: ['path', 'find', 'replace'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_delete',
      description: 'Delete a file inside the project workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative path from the project root to the file that should be deleted.',
          },
        },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_move',
      description: 'Move or rename a file or folder inside the allowed filesystem scope.',
      parameters: {
        type: 'object',
        properties: {
          from_path: {
            type: 'string',
            description: 'Current file or folder path.',
          },
          to_path: {
            type: 'string',
            description: 'Destination file or folder path.',
          },
        },
        required: ['from_path', 'to_path'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_copy',
      description: 'Copy a file or folder inside the allowed filesystem scope.',
      parameters: {
        type: 'object',
        properties: {
          from_path: {
            type: 'string',
            description: 'Source file or folder path.',
          },
          to_path: {
            type: 'string',
            description: 'Destination file or folder path.',
          },
        },
        required: ['from_path', 'to_path'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'directory_create',
      description: 'Create a folder inside the allowed filesystem scope.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Folder path to create.',
          },
        },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'glob',
      description: 'Find files by glob pattern inside the project workspace.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern, e.g. **/*.ts' },
          limit: { type: 'number', description: 'Max results (default 200).' },
        },
        required: ['pattern'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'grep',
      description: 'Search file contents for a string or regex.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Text or regex pattern.' },
          path: { type: 'string', description: 'Relative directory or file (default ".").' },
          regex: { type: 'boolean', description: 'Treat pattern as regex.' },
          limit: { type: 'number', description: 'Max matches (default 200).' },
        },
        required: ['pattern'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bash_exec',
      description: 'Execute shell commands on the user computer (bash, cmd, powershell).',
      parameters: {
        type: 'object',
        properties: {
          cmd: {
            type: 'string',
            description: 'Command to run.',
          },
        },
        required: ['cmd'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Web search allows accessibility to up-to-date information from the internet.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'O termo a ser buscado.' },
          filters: {
            type: 'object',
            properties: {
              allowed_domains: { type: 'array', items: { type: 'string' } },
              blocked_domains: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        required: ['query'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'todo_list',
      description: 'List local todos stored in .chocks/todos.json.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'todo_add',
      description: 'Add a todo item.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Todo text' },
        },
        required: ['text'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'todo_update',
      description: 'Update a todo item by id.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Todo id' },
          text: { type: 'string', description: 'Updated text' },
          done: { type: 'boolean', description: 'Mark complete' },
        },
        required: ['id'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'workflow_get',
      description: 'Read the active workflow plan for the current task.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'workflow_replace',
      description: 'Create or replace the active workflow plan.',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'User-visible goal.' },
          summary: { type: 'string', description: 'Optional short note.' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
                status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
              },
              required: ['text'],
              additionalProperties: false,
            },
          },
        },
        required: ['goal', 'steps'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'workflow_update_step',
      description: 'Update one workflow step.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          text: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
        },
        required: ['id'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'workflow_clear',
      description: 'Clear the active workflow plan.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'env_get',
      description: 'Read environment variables.',
      parameters: {
        type: 'object',
        properties: {
          keys: { type: 'array', items: { type: 'string' } },
        },
        required: ['keys'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pwd',
      description: 'Return the project root path.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ls_safe',
      description: 'List directory entries.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'agent_help_request',
      description: 'Peça ajuda ou informação para outro membro da família.',
      parameters: {
        type: 'object',
        properties: {
          agent_id: { type: 'string' },
          message: { type: 'string' }
        },
        required: ['agent_id', 'message'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'handoff_to_agent',
      description: 'Transferência de controle.',
      parameters: {
        type: 'object',
        properties: {
          agent_id: { type: 'string' },
          reason: { type: 'string' }
        },
        required: ['agent_id', 'reason'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'consult_agent',
      description: 'Consulta um especialista da família.',
      parameters: {
        type: 'object',
        properties: {
          agent_id: { type: 'string' },
          question: { type: 'string' }
        },
        required: ['agent_id', 'question'],
        additionalProperties: false
      }
    }
  }
]

export function getToolStatuses(context?: Pick<ToolContext, 'permissionMode'>): ToolStatus[] {
  const permissionMode = normalizePermissionMode(context?.permissionMode)
  const annotate = (tool: string, status: ToolStatus): ToolStatus => {
    if (permissionMode === 'read_only' && !isReadOnlyTool(tool)) {
      return { ...status, enabled: false, reason: 'blocked by read-only permission mode' }
    }
    if (permissionMode === 'ask' && requiresExplicitUserApproval(tool)) {
      return { ...status, reason: 'requires explicit user request in ask mode' }
    }
    return status
  }

  return [
    annotate('file_read', { name: 'file_read', enabled: true, category: 'files' }),
    annotate('file_write', { name: 'file_write', enabled: true, category: 'files' }),
    annotate('file_edit', { name: 'file_edit', enabled: true, category: 'files' }),
    annotate('file_copy', { name: 'file_copy', enabled: true, category: 'files' }),
    annotate('file_delete', { name: 'file_delete', enabled: true, category: 'files' }),
    annotate('file_move', { name: 'file_move', enabled: true, category: 'files' }),
    annotate('directory_create', { name: 'directory_create', enabled: true, category: 'files' }),
    annotate('glob', { name: 'glob', enabled: true, category: 'search' }),
    annotate('grep', { name: 'grep', enabled: true, category: 'search' }),
    annotate('bash_exec', {
      name: 'bash_exec',
      enabled: ALLOW_BASH_EXEC,
      category: 'execution',
      reason: ALLOW_BASH_EXEC ? 'enabled' : 'disabled',
    }),
    annotate('web_search', {
      name: 'web_search',
      enabled: ALLOW_WEB_FETCH_VAL(),
      category: 'web',
      reason: ALLOW_WEB_FETCH_VAL() ? 'Official OpenAI search enabled' : 'disabled',
    }),
    annotate('todo_list', { name: 'todo_list', enabled: true, category: 'planning' }),
    annotate('todo_add', { name: 'todo_add', enabled: true, category: 'planning' }),
    annotate('todo_update', { name: 'todo_update', enabled: true, category: 'planning' }),
    annotate('workflow_get', { name: 'workflow_get', enabled: true, category: 'workflow' }),
    annotate('workflow_replace', { name: 'workflow_replace', enabled: true, category: 'workflow' }),
    annotate('workflow_update_step', { name: 'workflow_update_step', enabled: true, category: 'workflow' }),
    annotate('workflow_clear', { name: 'workflow_clear', enabled: true, category: 'workflow' }),
    annotate('agent_help_request', { name: 'agent_help_request', enabled: true, category: 'coordination' }),
    annotate('env_get', { name: 'env_get', enabled: true, category: 'system' }),
    annotate('pwd', { name: 'pwd', enabled: true, category: 'system' }),
    annotate('ls_safe', { name: 'ls_safe', enabled: true, category: 'system' }),
  ]
}

export async function runTool(tool: string, inputRaw: { [key: string]: unknown }, context?: ToolContext): Promise<ToolResult> {
  const input = inputRaw as any;
  assertToolPermission(tool, context)
  const sandbox = await sandboxManager.getSandbox(context?.chatId || 'global')

  if (tool === 'file_read' || tool === 'file.read') {
    const data = await sandbox.read(input?.path)
    return { ok: true, output: data }
  }

  if (tool === 'file_write' || tool === 'file.write') {
    await sandbox.write(input?.path, input?.content, !!input?.append)
    return { ok: true, output: { path: input?.path, append: !!input?.append } }
  }

  if (tool === 'file_edit') {
    const abs = assertAllowedPath(input?.path, context)
    const original = await readTextFile(abs)
    const replaced = input?.replace_all ? original.split(input?.find).join(input?.replace) : original.replace(input?.find, input?.replace)
    if (replaced === original) return { ok: false, output: { changed: false } }
    await fs.writeFile(abs, replaced, 'utf8')
    return { ok: true, output: { changed: true, path: input?.path } }
  }

  if (tool === 'file_delete') {
    const abs = assertAllowedPath(input?.path, context)
    await fs.unlink(abs)
    return { ok: true, output: { deleted: true, path: input?.path } }
  }

  if (tool === 'file_move') {
    const fromAbs = assertAllowedPath(input?.from_path, context)
    const toAbs = assertAllowedPath(input?.to_path, context)
    await fs.rename(fromAbs, toAbs)
    return { ok: true, output: { moved: true } }
  }

  if (tool === 'file_copy') {
    const fromAbs = assertAllowedPath(input?.from_path, context)
    const toAbs = assertAllowedPath(input?.to_path, context)
    await fs.copyFile(fromAbs, toAbs)
    return { ok: true, output: { copied: true } }
  }

  if (tool === 'directory_create') {
    const abs = assertAllowedPath(input?.path, context)
    await fs.mkdir(abs, { recursive: true })
    return { ok: true, output: { created: true } }
  }

  if (tool === 'glob') {
    const matches = await fg(input?.pattern, { cwd: PROJECT_ROOT, dot: true })
    return { ok: true, output: matches.slice(0, input?.limit || 200) }
  }

  if (tool === 'grep') {
    const abs = assertAllowedPath(input?.path || '.', context)
    const stats = await fs.stat(abs)
    const files = stats.isDirectory() ? await fg('**/*', { cwd: abs, dot: true }) : [path.basename(abs)]
    const results: any[] = []
    const re = input?.regex ? new RegExp(input?.pattern, 'u') : null
    for (const file of files) {
      const text = await readTextFile(path.resolve(stats.isDirectory() ? abs : path.dirname(abs), file))
      text.split('\n').forEach((line, i) => {
        if (re ? re.test(line) : line.includes(input?.pattern)) {
          results.push({ file, line: i + 1, text: line })
        }
      })
    }
    return { ok: true, output: results.slice(0, input?.limit || 200) }
  }

  if (tool === 'bash_exec' || tool === 'bash.exec') {
    const result = await sandbox.exec(input?.cmd)
    return { ok: result.ok, output: { stdout: result.stdout, stderr: result.stderr } }
  }

  if (tool === 'web_search') {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await client.chat.completions.create({
      model: 'gpt-4o-search-preview',
      messages: [{ role: 'user', content: input?.query }],
    })
    return { ok: true, output: { content: response.choices[0]?.message?.content } }
  }

  if (tool === 'handoff_to_agent') {
    return { ok: true, output: { handoff: true, targetAgentId: input?.agent_id, reason: input?.reason } }
  }

  if (tool === 'consult_agent') {
    return { ok: true, output: { consult: true, targetAgentId: input?.agent_id, question: input?.question } }
  }

  if (tool === 'todo_list') {
    const data = await listTodos(resolveUser(context).id)
    return { ok: true, output: data }
  }

  if (tool === 'todo_add') {
    const item = await addTodo(input?.text, resolveUser(context))
    return { ok: true, output: item }
  }

  if (tool === 'todo_update') {
    const item = await updateTodo(input?.id, { text: input?.text, done: input?.done }, resolveUser(context).id)
    return { ok: true, output: item }
  }

  if (tool === 'workflow_get') {
    const active = await getWorkflowState(resolveWorkflowChatId(context), resolveUser(context).id)
    return { ok: true, output: active }
  }

  if (tool === 'workflow_replace') {
    const nextState: WorkflowState = {
      chatId: resolveWorkflowChatId(context),
      goal: input?.goal,
      summary: input?.summary,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: input?.steps.map(normalizeWorkflowStep),
    }
    const saved = await saveWorkflowState(nextState, resolveUser(context))
    return { ok: true, output: saved }
  }

  if (tool === 'workflow_update_step') {
    const active = await getWorkflowState(resolveWorkflowChatId(context), resolveUser(context).id)
    if (!active) throw new Error('no active workflow')
    const step = active.steps.find(item => item.id === input?.id)
    if (step) {
      if (input?.text) step.text = input.text
      if (input?.status) step.status = input.status as any
    }
    active.updatedAt = new Date().toISOString()
    const saved = await saveWorkflowState(active, resolveUser(context))
    return { ok: true, output: saved }
  }

  if (tool === 'workflow_clear') {
    const cleared = await clearWorkflowState(resolveWorkflowChatId(context), resolveUser(context).id)
    return { ok: true, output: cleared }
  }

  if (tool === 'env_get') {
    const out: Record<string, string | null> = {}
    input?.keys.forEach((k: string) => { out[k] = process.env[k] ?? null })
    return { ok: true, output: out }
  }

  if (tool === 'pwd') {
    return { ok: true, output: PROJECT_ROOT }
  }

  if (tool === 'ls_safe') {
    const abs = assertAllowedPath(input?.path || '.', context)
    const entries = await fs.readdir(abs, { withFileTypes: true })
    return { ok: true, output: { entries: entries.map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' })) } }
  }

  throw new Error(`unknown tool: ${tool}`)
}
