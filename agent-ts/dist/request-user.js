export function getRequestUser(req) {
    const idHeader = req.header('x-chocks-user-id');
    const displayNameHeader = req.header('x-chocks-display-name');
    // Try body/query as secondary sources, default to legacy-local
    const id = String(idHeader || req.body?.userId || req.query?.userId || 'legacy-local').trim() || 'legacy-local';
    const displayName = String(displayNameHeader || req.body?.displayName || 'Local user').trim() || 'Local user';
    return { id, displayName };
}
