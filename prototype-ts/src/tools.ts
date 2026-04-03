import fs from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'

const execp = promisify(exec)

export type ToolResult = { ok: boolean; output?: any }

export async function runTool(tool: string, input: any): Promise<ToolResult> {
  if (tool === 'file.read') {
    const path = input?.path
    if (!path) throw new Error('input.path required')
    const data = await fs.readFile(path, 'utf8')
    return { ok: true, output: data }
  }

  if (tool === 'bash.exec') {
    const cmd = input?.cmd
    if (!cmd) throw new Error('input.cmd required')
    const { stdout, stderr } = await execp(cmd)
    return { ok: true, output: { stdout, stderr } }
  }

  throw new Error(`unknown tool: ${tool}`)
}
