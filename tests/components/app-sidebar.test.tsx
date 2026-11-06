import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { AccountMenu } from "../../src/components/app-sidebar";
import { useAuthSession } from "../../src/lib/auth";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useRouter: () => ({}) }));
vi.mock("../../src/lib/auth", () => ({ useAuthSession: vi.fn(), signOut: vi.fn() }));

function renderAccountMenu(user: { name?: string; email: string } | null) {
  vi.mocked(useAuthSession).mockReturnValue({
    data: user ? { user: { id: "user_1", ...user } } : null,
    isPending: false,
  } as never);

  render(<AccountMenu />);
}

describe("AccountMenu", () => {
  test("names the signed-in user", () => {
    renderAccountMenu({ name: "Ada Lovelace", email: "ada@example.com" });

    expect(screen.getByRole("button", { name: /Ada Lovelace/ })).toBeInTheDocument();
  });

  test("falls back to the email name when the provider has no name", () => {
    renderAccountMenu({ email: "ada@example.com" });

    expect(screen.getByRole("button", { name: "Account menu for ada" })).toBeInTheDocument();
  });
});
