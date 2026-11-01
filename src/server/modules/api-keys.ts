import type { Scope } from "@samrian/contracts";

import { getScopePermissions } from "../auth/policy";
import { AccessError } from "../auth/session";
import type { AuthContext, PermissionRequest } from "../auth/types";
import type { MachineCredential } from "../auth/machine";
import type { Logger } from "../observability/logs";
import { logger as defaultLogger } from "../observability/runtime";

type Deps = { actor: AuthContext; provider: MachineCredential; logger?: Pick<Logger, "info"> };

export function listApiKeys(deps: Deps) {
  return deps.provider.list({ orgId: deps.actor.orgId });
}

export async function createApiKey(
  input: { name: string; scopes: Scope[] },
  deps: Deps & { hasPermission(permissions: PermissionRequest): Promise<boolean> }
) {
  const required = getScopePermissions(input.scopes);
  if (Object.keys(required).length > 0 && !(await deps.hasPermission(required))) {
    throw new AccessError("FORBIDDEN", `Cannot grant scopes: ${JSON.stringify(required)}`);
  }

  const result = await deps.provider.create({
    ...input,
    orgId: deps.actor.orgId,
    userId: deps.actor.userId,
  });
  (deps.logger ?? defaultLogger).info("credential.created", {
    orgId: deps.actor.orgId,
    userId: deps.actor.userId,
    credentialId: result.id,
    scopes: result.scopes,
  });
  return result;
}

export async function revokeApiKey(id: string, deps: Deps) {
  const result = await deps.provider.revoke({ id, orgId: deps.actor.orgId });
  (deps.logger ?? defaultLogger).info("credential.revoked", {
    orgId: deps.actor.orgId,
    userId: deps.actor.userId,
    credentialId: id,
    provider: result.provider,
    reversible: result.reversible,
  });
  return result;
}
