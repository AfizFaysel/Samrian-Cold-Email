import { scopes } from "@samrian/contracts";
import { describe, expect, it, vi } from "vitest";

import { member, owner } from "../../../lib/permissions";
import { getScopePermissions } from "../../../src/server/auth/policy";
import { createApiKey, revokeApiKey } from "../../../src/server/modules/api-keys";
import type { Logger } from "../../../src/server/observability/logs";
import type { MachineCredential } from "../../../src/server/auth/machine";

const actor = { userId: "user_1", orgId: "org_1", role: "member" };

function credentials(): MachineCredential {
  return {
    create: vi.fn().mockResolvedValue({
      id: "key_1",
      name: "CI",
      value: "sam_secret",
      scopes: ["contacts:read"],
      createdAt: "2026-07-13T10:00:00.000Z",
    }),
    list: vi.fn(),
    verify: vi.fn(),
    revoke: vi.fn().mockResolvedValue({
      revoked: true,
      reversible: true,
      provider: "better-auth",
    }),
  };
}

describe("API key management", () => {
  it("forces organization from authenticated owner context", async () => {
    const provider = credentials();

    await createApiKey(
      { name: "CI", scopes: ["contacts:read"] },
      {
        actor: { userId: "user_1", orgId: "org_1", role: "owner" },
        provider,
        hasPermission: async () => true,
      }
    );

    expect(provider.create).toHaveBeenCalledWith({
      orgId: "org_1",
      userId: "user_1",
      name: "CI",
      scopes: ["contacts:read"],
    });
  });

  it("refuses scopes the creator does not hold", async () => {
    const provider = credentials();
    const hasPermission = vi.fn(async () => false);

    await expect(
      createApiKey(
        { name: "CI", scopes: ["contacts:read", "contacts:write", "campaigns:launch"] },
        { actor, provider, hasPermission }
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(hasPermission).toHaveBeenCalledWith({
      contact: ["read", "create", "update", "import"],
      campaign: ["launch"],
    });
    expect(provider.create).not.toHaveBeenCalled();
  });

  it("needs no permission for identity-only keys", async () => {
    const provider = credentials();
    const hasPermission = vi.fn(async () => false);

    await createApiKey(
      { name: "Whoami", scopes: ["identity:read"] },
      { actor, provider, hasPermission }
    );

    expect(hasPermission).not.toHaveBeenCalled();
    expect(provider.create).toHaveBeenCalledOnce();
  });

  it.each(scopes.filter((scope) => scope !== "identity:read"))("owner can grant %s", (scope) => {
    expect(owner.authorize(getScopePermissions([scope])).success).toBe(true);
  });

  it.each(["contacts:write", "blocklist:write", "groups:write", "mailboxes:check"] as const)(
    "a built-in member cannot grant %s",
    (scope) => {
      expect(member.authorize(getScopePermissions([scope])).success).toBe(false);
    }
  );

  it("audits create and revoke without credential plaintext", async () => {
    const provider = credentials();
    const info = vi.fn();
    const logger = { info } as unknown as Logger;
    const deps = {
      actor: { userId: "user_1", orgId: "org_1", role: "owner" as const },
      provider,
      logger,
      hasPermission: async () => true,
    };

    await createApiKey({ name: "CI", scopes: ["contacts:read"] }, deps);
    await revokeApiKey("key_1", deps);

    expect(info).toHaveBeenCalledWith(
      "credential.created",
      expect.objectContaining({ orgId: "org_1", credentialId: "key_1" })
    );
    expect(info).toHaveBeenCalledWith(
      "credential.revoked",
      expect.objectContaining({ orgId: "org_1", credentialId: "key_1" })
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain("sam_secret");
  });
});
