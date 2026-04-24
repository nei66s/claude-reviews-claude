import path from 'path'
import { LocalSandbox } from './local-sandbox'
import type { ISandboxClient } from './types'

export class SandboxManager {
  private sandboxes: Map<string, ISandboxClient> = new Map()
  private defaultRoot: string

  constructor(defaultRoot: string) {
    this.defaultRoot = path.resolve(defaultRoot)
  }

  async getSandbox(id: string): Promise<ISandboxClient> {
    if (this.sandboxes.has(id)) {
      return this.sandboxes.get(id)!
    }

    const sandbox = new LocalSandbox(id, this.defaultRoot)
    await sandbox.init()
    
    this.sandboxes.set(id, sandbox)
    return sandbox
  }

  async closeSandbox(id: string): Promise<void> {
    const sandbox = this.sandboxes.get(id)
    if (sandbox) {
      await sandbox.destroy()
      this.sandboxes.delete(id)
    }
  }
}

// Global manager instance
// We use the project root from environment or current working directory
const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd()
export const sandboxManager = new SandboxManager(PROJECT_ROOT)
