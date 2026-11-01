import { getAuthProvider } from "./provider";
import type { AuthContext, AuthDeps, PermissionRequest, SessionData } from "./types";

export class AccessError extends Error {
  constructor(
    readonly code: "UNAUTHENTICATED" | "FORBIDDEN",
    message: string
  ) {
    super(message);
    this.name = "AccessError";
  }
}

export async function requireSession(deps?: Pick<AuthDeps, "getSession">): Promise<SessionData> {
  const session = await (deps?.getSession ? deps.getSession() : getAuthProvider().getSession());

  if (!session?.user) {
    throw new AccessError("UNAUTHENTICATED", "Unauthorized");
  }

  return session;
}

export async function requireActiveOrg(deps?: AuthDeps): Promise<AuthContext> {
  if (!deps) {
    const context = await getAuthProvider().getActiveOrg();

    if (!context) {
      // getActiveOrg returns null for both cases, so the session lookup runs on failures only.
      const session = await getAuthProvider().getSession();
      throw new AccessError(
        session?.user ? "FORBIDDEN" : "UNAUTHENTICATED",
        "No active organization"
      );
    }

    return context;
  }

  const session = await requireSession(deps);
  const orgId = session.session.activeOrganizationId;

  if (!orgId) {
    throw new AccessError("FORBIDDEN", "No active organization");
  }

  const member = deps?.getMember
    ? await deps.getMember({ userId: session.user.id, orgId })
    : { role: session.session.roles?.[0] ?? "member" };

  if (!member) {
    throw new AccessError("FORBIDDEN", "No active organization");
  }

  return {
    userId: session.user.id,
    orgId,
    role: member.role,
  };
}

export async function requireOrgAccess(
  deps?: AuthDeps,
  permissions?: PermissionRequest
): Promise<AuthContext> {
  const context = await requireActiveOrg(deps);

  if (permissions) {
    const allowed = deps?.hasPermission
      ? await deps.hasPermission(permissions)
      : await getAuthProvider().hasPermission(permissions);

    if (!allowed) {
      throw new AccessError("FORBIDDEN", `Missing permissions: ${JSON.stringify(permissions)}`);
    }
  }

  return context;
}

export async function verifyOrgOwnership<T extends { orgId: string } | null>(
  resource: T,
  orgId: string,
  resourceName = "Resource"
): Promise<Exclude<T, null>> {
  if (!resource || resource.orgId !== orgId) {
    throw new Error(`${resourceName} not found`);
  }

  return resource as Exclude<T, null>;
}
