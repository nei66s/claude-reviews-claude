/**
 * Social Protocols — Role-based automatic behaviors
 * NIVEL SOCIAL: Context-aware protocol responses
 * 
 * Knows what each role can do without asking
 * Automatic approval for pre-approved patterns
 */

export type UserRole = 'admin' | 'moderator' | 'user' | 'guest' | 'bot'

export type Permission = {
  action: string
  allowedRoles: UserRole[]
  requiresApproval: boolean
  rateLimit?: number // per minute
}

export type SocialProtocol = {
  id: string
  roles: UserRole[]
  condition: (context: any) => boolean
  action: string
  description: string
}

const DEFAULT_PERMISSIONS: Permission[] = [
  {
    action: 'read_file',
    allowedRoles: ['admin', 'moderator', 'user'],
    requiresApproval: false,
  },
  {
    action: 'write_file',
    allowedRoles: ['admin', 'moderator'],
    requiresApproval: true,
  },
  {
    action: 'execute_bash',
    allowedRoles: ['admin'],
    requiresApproval: true,
  },
  {
    action: 'access_database',
    allowedRoles: ['admin', 'moderator'],
    requiresApproval: false,
  },
  {
    action: 'manage_users',
    allowedRoles: ['admin'],
    requiresApproval: true,
  },
  {
    action: 'view_audit_log',
    allowedRoles: ['admin', 'moderator'],
    requiresApproval: false,
  },
]

export class SocialProtocolManager {
  private permissions: Map<string, Permission> = new Map()
  private protocols: SocialProtocol[] = []

  constructor() {
    // Initialize default permissions
    for (const perm of DEFAULT_PERMISSIONS) {
      this.permissions.set(perm.action, perm)
    }

    // Initialize default protocols
    this.registerProtocol({
      id: 'admin_bypass_approval',
      roles: ['admin'],
      condition: () => true,
      action: 'skip_user_approval_checks',
      description: 'Admin can perform actions without approval',
    })

    this.registerProtocol({
      id: 'moderator_audit_view',
      roles: ['moderator'],
      condition: (ctx) => ctx.action === 'view_audit_log',
      action: 'auto_allow',
      description: 'Moderator can view audit logs automatically',
    })

    this.registerProtocol({
      id: 'guest_read_only',
      roles: ['guest'],
      condition: (ctx) => ctx.action?.startsWith('read'),
      action: 'auto_allow',
      description: 'Guest can read but not write',
    })
  }

  /**
   * Register a new permission rule
   */
  registerPermission(perm: Permission): void {
    this.permissions.set(perm.action, perm)
  }

  /**
   * Register a new social protocol
   */
  registerProtocol(protocol: SocialProtocol): void {
    this.protocols.push(protocol)
  }

  /**
   * Check if a role can perform an action
   */
  canPerform(
    role: UserRole,
    action: string,
  ): { allowed: boolean; requiresApproval: boolean; reason?: string } {
    const perm = this.permissions.get(action)

    if (!perm) {
      return { allowed: false, requiresApproval: false, reason: `Unknown action: ${action}` }
    }

    const isAllowed = perm.allowedRoles.includes(role)

    if (!isAllowed) {
      return {
        allowed: false,
        requiresApproval: true,
        reason: `Role '${role}' not allowed for action '${action}'`,
      }
    }

    return {
      allowed: true,
      requiresApproval: perm.requiresApproval,
    }
  }

  /**
   * Apply social protocols to an action
   * Returns: 'auto_allow', 'auto_deny', 'require_approval', null (unknown)
   */
  applyProtocols(
    role: UserRole,
    action: string,
    context?: any,
  ): 'auto_allow' | 'auto_deny' | 'require_approval' | null {
    const ctx = { action, role, ...context }

    // Check specific protocols
    for (const protocol of this.protocols) {
      if (protocol.roles.includes(role) && protocol.condition(ctx)) {
        return protocol.action as any
      }
    }

    // Fall back to permission check
    const canDo = this.canPerform(role, action)
    if (!canDo.allowed) {
      return 'auto_deny'
    }
    if (canDo.requiresApproval) {
      return 'require_approval'
    }

    return 'auto_allow'
  }

  /**
   * Get all protocols for a role
   */
  getProtocolsForRole(role: UserRole): SocialProtocol[] {
    return this.protocols.filter(p => p.roles.includes(role))
  }

  /**
   * Describe available actions for a role
   */
  describeRole(role: UserRole): {
    role: UserRole
    allowed: string[]
    requiresApproval: string[]
    denied: string[]
  } {
    const allowed: string[] = []
    const requiresApproval: string[] = []
    const denied: string[] = []

    for (const [action] of this.permissions) {
      const result = this.canPerform(role, action)
      if (!result.allowed) {
        denied.push(action)
      } else if (result.requiresApproval) {
        requiresApproval.push(action)
      } else {
        allowed.push(action)
      }
    }

    return { role, allowed, requiresApproval, denied }
  }
}

export const socialProtocolManager = new SocialProtocolManager()
