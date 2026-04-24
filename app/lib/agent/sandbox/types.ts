export interface SandboxEntry {
  name: string
  path: string
  type: 'file' | 'dir'
  size?: number
}

export interface SandboxResult {
  ok: boolean
  stdout?: string
  stderr?: string
  output?: any
}

export interface ISandboxClient {
  id: string
  root: string

  // Execution
  exec(cmd: string): Promise<SandboxResult>

  // Filesystem
  read(path: string): Promise<string>
  write(path: string, content: string, append?: boolean): Promise<void>
  ls(path: string): Promise<SandboxEntry[]>
  delete(path: string): Promise<void>
  exists(path: string): Promise<boolean>

  // Lifecycle
  init(): Promise<void>
  destroy(): Promise<void>

  // Snapshots
  snapshot(id: string): Promise<string>
  restore(id: string): Promise<void>
}
