import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AcceptInvitation } from "../../src/components/accept-invitation";
import { useAuthSession } from "../../src/lib/auth";
import { authClient } from "../../src/lib/auth-client";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../../src/lib/auth", () => ({ useAuthSession: vi.fn() }));
vi.mock("../../src/lib/auth-client", () => ({
  authClient: {
    organization: { acceptInvitation: vi.fn(), setActive: vi.fn(async () => ({})) },
    sendVerificationEmail: vi.fn(async () => ({})),
  },
}));

const signedIn = () =>
  vi.mocked(useAuthSession).mockReturnValue({
    data: { user: { id: "user_1", email: "ada@example.com" } },
    isPending: false,
  } as never);

describe("AcceptInvitation", () => {
  beforeEach(() => vi.clearAllMocks());

  test("asks a signed-out visitor to sign in and come back", () => {
    vi.mocked(useAuthSession).mockReturnValue({ data: null, isPending: false } as never);

    render(<AcceptInvitation invitationId="inv_1" />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?redirect=%2Faccept-invitation%2Finv_1"
    );
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/sign-up?redirect=%2Faccept-invitation%2Finv_1"
    );
  });

  test("never accepts just because the link was opened", () => {
    signedIn();

    render(<AcceptInvitation invitationId="inv_1" />);

    expect(authClient.organization.acceptInvitation).not.toHaveBeenCalled();
  });

  test("joins and activates the organization on click", async () => {
    signedIn();
    vi.mocked(authClient.organization.acceptInvitation).mockResolvedValue({
      data: { invitation: { organizationId: "org_1" } },
    } as never);

    render(<AcceptInvitation invitationId="inv_1" />);
    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(authClient.organization.setActive).toHaveBeenCalledWith({ organizationId: "org_1" });
  });

  test("offers to resend verification when the address is unverified", async () => {
    signedIn();
    vi.mocked(authClient.organization.acceptInvitation).mockResolvedValue({
      error: {
        code: "EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION",
        message: "Verify first",
      },
    } as never);

    render(<AcceptInvitation invitationId="inv_1" />);
    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));
    fireEvent.click(await screen.findByRole("button", { name: "Send verification email" }));

    await waitFor(() =>
      expect(authClient.sendVerificationEmail).toHaveBeenCalledWith({
        email: "ada@example.com",
        callbackURL: "/accept-invitation/inv_1",
      })
    );
  });

  test("shows why an invitation cannot be used", async () => {
    signedIn();
    vi.mocked(authClient.organization.acceptInvitation).mockResolvedValue({
      error: { message: "Invitation not found" },
    } as never);

    render(<AcceptInvitation invitationId="inv_1" />);
    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invitation not found");
  });
});
