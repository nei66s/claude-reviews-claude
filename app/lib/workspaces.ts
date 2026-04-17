export const workspaceRouteById = {
  conversations: "/conversations",
  code: "/code",
  files: "/files",
  coordinator: "/coordinator",
  monitor: "/monitor",
  swarm: "/swarm",
  audit: "/audit",
  coordination: "/coordination",
  "doutora-kitty": "/doutora-kitty",
  "memory-admin": "/memory-admin",
  "memory-graph": "/memory-graph",
} as const;

export type WorkspaceId = keyof typeof workspaceRouteById;

export const workspaceIds = Object.keys(workspaceRouteById) as WorkspaceId[];

export function getWorkspaceRoute(id: WorkspaceId) {
  return workspaceRouteById[id];
}

export function getWorkspaceFromPathname(pathname: string | null | undefined): WorkspaceId {
  if (!pathname || pathname === "/") {
    return "conversations";
  }

  const segment = pathname.split("/").filter(Boolean)[0];
  return workspaceIds.includes(segment as WorkspaceId)
    ? (segment as WorkspaceId)
    : "conversations";
}
