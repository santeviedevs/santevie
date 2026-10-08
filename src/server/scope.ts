import { findManagerLinks } from "@/server/repositories/user-repository";

// Every list or report query that returns user-attributable rows must be
// filtered through this before it reaches Prisma. A missed hierarchy filter
// means one supervisor sees another team's data, which is a breach, not a
// bug (execution plan, section 4).
export type Scope = { kind: "all" } | { kind: "ids"; userIds: readonly string[] };

// roleName is typed as a bare string on the session (it round-trips through
// the JWT, not the RoleName union in permissions.ts), so it's compared
// against the ROLES literals rather than narrowed at the type level.
export type ScopeSession = { user: { id: string; roleName: string } };

// Only ADMIN is truly unrestricted. MANAGER holds the same *:view-all-named
// permissions as ADMIN in the role matrix, but that permission name
// describes the *ceiling* of what they're allowed to reach (everything, if
// they personally manage it), not an automatic grant of the whole
// org — same tree-scoping mechanism as SUPERVISOR, just rooted one level
// higher. A MANAGER with no downstream reports of their own sees only
// themselves, exactly like any other role would.
//
// Changed from the original "MANAGER = kind: all" behavior (indistinguishable
// from ADMIN) after the user explicitly confirmed each manager should only
// see their own downstream org, not every user in the system — this was
// never exercised differently in testing since the seed data only has one
// Manager account.
export async function getUserScope(session: ScopeSession): Promise<Scope> {
  const { roleName, id } = session.user;

  if (roleName === "ADMIN") {
    return { kind: "all" };
  }

  if (roleName === "MANAGER" || roleName === "SUPERVISOR") {
    const downstream = await getDownstreamUserIds(id);
    return { kind: "ids", userIds: [id, ...downstream] };
  }

  return { kind: "ids", userIds: [id] };
}

// Every user reporting to `managerId`, directly or transitively. One query
// for the whole table (see findManagerLinks) and a breadth-first walk in
// memory, consistent with the cycle check in user-service.ts and cheap at
// the row counts a sales org actually reaches. The `visited` guard is a
// defensive backstop only — assertNoManagerCycle already prevents a cycle
// from being written in the first place.
export async function getDownstreamUserIds(managerId: string): Promise<string[]> {
  const links = await findManagerLinks();
  const childrenOf = new Map<string, string[]>();
  for (const link of links) {
    if (!link.managerId) continue;
    const siblings = childrenOf.get(link.managerId) ?? [];
    siblings.push(link.id);
    childrenOf.set(link.managerId, siblings);
  }

  const visited = new Set<string>();
  const downstream: string[] = [];
  const queue = [...(childrenOf.get(managerId) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (visited.has(current)) continue;
    visited.add(current);
    downstream.push(current);
    queue.push(...(childrenOf.get(current) ?? []));
  }
  return downstream;
}

// Every manager above `userId`, directly or transitively — the mirror image
// of getDownstreamUserIds, walking managerId upward instead of down. Used by
// S3-04's attendance-rule resolution to gather "team scope" candidates: a
// rule owned by any manager/supervisor above a delegate in the chain is a
// candidate for that delegate.
export async function getUpstreamManagerIds(userId: string): Promise<string[]> {
  const links = await findManagerLinks();
  const managerOf = new Map<string, string | null>();
  for (const link of links) managerOf.set(link.id, link.managerId);

  const visited = new Set<string>();
  const upstream: string[] = [];
  let current = managerOf.get(userId) ?? null;
  while (current && !visited.has(current)) {
    visited.add(current);
    upstream.push(current);
    current = managerOf.get(current) ?? null;
  }
  return upstream;
}

export function isWithinScope(scope: Scope, userId: string): boolean {
  return scope.kind === "all" || scope.userIds.includes(userId);
}

// The id list a repository should filter on, or undefined for "no filter"
// (an unrestricted scope), matching how findUsers/findUserById already
// treat an absent constraint.
export function scopeUserIds(scope: Scope): string[] | undefined {
  return scope.kind === "all" ? undefined : [...scope.userIds];
}
