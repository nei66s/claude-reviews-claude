import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { ISandboxClient, SandboxEntry, SandboxResult } from './types'

const execp = promisify(exec)

export class LocalSandbox implements ISandboxClient {
  public id: string
  public root: string

  constructor(id: string, root: string) {
    this.id = id
    this.root = path.resolve(root)
  }

  private resolve(relPath: string) {
    const abs = path.isAbsolute(relPath) ? relPath : path.resolve(this.root, relPath)
    if (!abs.startsWith(this.root)) {
      throw new Error(`Access denied: path '${relPath}' is outside sandbox root`)
    }
    return abs
  }

  async init(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true })
  }

  async destroy(): Promise<void> {
    // For local sandbox, we keep the workdir unless explicitly told otherwise
  }

  async exec(cmd: string): Promise<SandboxResult> {
    try {
      const { stdout, stderr } = await execp(cmd, { cwd: this.root })
      return { ok: true, stdout, stderr }
    } catch (err: any) {
      return { ok: false, stdout: err.stdout, stderr: err.stderr || err.message }
    }
  }

  async read(relPath: string): Promise<string> {
    const abs = this.resolve(relPath)
    return fs.readFile(abs, 'utf8')
  }

  async write(relPath: string, content: string, append = false): Promise<void> {
    const abs = this.resolve(relPath)
    await fs.mkdir(path.dirname(abs), { recursive: true })
    if (append) {
      await fs.appendFile(abs, content, 'utf8')
    } else {
      await fs.writeFile(abs, content, 'utf8')
    }
  }

  async ls(relPath: string): Promise<SandboxEntry[]> {
    const abs = this.resolve(relPath)
    const entries = await fs.readdir(abs, { withFileTypes: true })
    return entries.map(e => ({
      name: e.name,
      path: path.join(relPath, e.name),
      type: e.isDirectory() ? 'dir' : 'file'
    }))
  }

  async delete(relPath: string): Promise<void> {
    const abs = this.resolve(relPath)
    const stat = await fs.stat(abs)
    if (stat.isDirectory()) {
      await fs.rm(abs, { recursive: true, force: true })
    } else {
      await fs.unlink(abs)
    }
  }

  async exists(relPath: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(relPath))
      return true
    } catch {
      return false
    }
  }

  async snapshot(id: string): Promise<string> {
    const snapshotsDir = path.resolve(this.root, '..', '.chocks_snapshots', this.id)
    const snapshotPath = path.join(snapshotsDir, id)
    await fs.mkdir(snapshotsDir, { recursive: true })
    
    await fs.cp(this.root, snapshotPath, { 
      recursive: true, 
      filter: (src) => !src.includes('node_modules') && !src.includes('.git')
    })
    
    return id
  }

  async restore(id: string): Promise<void> {
    const snapshotsDir = path.resolve(this.root, '..', '.chocks_snapshots', this.id)
    const snapshotPath = path.join(snapshotsDir, id)
    
    if (!(await fs.stat(snapshotPath).catch(() => null))) {
      throw new Error(`Snapshot '${id}' not found`)
    }

    const entries = await fs.readdir(this.root)
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git') continue
      await fs.rm(path.join(this.root, entry), { recursive: true, force: true })
    }

    await fs.cp(snapshotPath, this.root, { recursive: true })
  }
}
