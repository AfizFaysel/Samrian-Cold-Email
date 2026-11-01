import { afterEach, describe, expect, test, vi } from "vitest";

import { createBetterRoleProvider } from "../../../src/server/auth/role-adapters";

afterEach(() => vi.unstubAllEnvs());

const input = { orgId: "org_1", email: "ada@example.com", role: "admin", inviterUserId: "user_1" };

function provider() {
  const createInvitation = vi.fn(async () => ({}));
  return {
    createInvitation,
    roles: createBetterRoleProvider({ createInvitation } as never, new Headers()),
  };
}

describe("Better Auth invitations", () => {
  test("are refused with a reason when email is not configured", async () => {
    vi.stubEnv("SYSTEM_SMTP_URL", "");
    const { roles, createInvitation } = provider();

    await expect(roles.inviteMember(input)).rejects.toMatchObject({
      message: "Set SYSTEM_SMTP_URL and SYSTEM_EMAIL_FROM to send invitations",
      status: 503,
    });
    expect(createInvitation).not.toHaveBeenCalled();
  });

  test("can be sent again to the same address", async () => {
    vi.stubEnv("SYSTEM_SMTP_URL", "smtps://mail.test");
    vi.stubEnv("SYSTEM_EMAIL_FROM", "hello@app.test");
    const { roles, createInvitation } = provider();

    await roles.inviteMember(input);

    expect(createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ resend: true }) })
    );
  });
});
