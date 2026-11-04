import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { AppSidebar } from "../../src/components/app-sidebar";
import { SidebarProvider } from "../../src/components/ui/sidebar";
import { useAuthSession } from "../../src/lib/auth";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useRouter: () => ({}) }));
vi.mock("../../src/lib/auth", () => ({ useAuthSession: vi.fn(), signOut: vi.fn() }));
vi.mock("../../src/hooks/use-mobile", () => ({ useIsMobile: () => false }));

function renderSidebar(user: { name?: string; email: string } | null) {
  vi.mocked(useAuthSession).mockReturnValue({
    data: user ? { user: { id: "user_1", ...user } } : null,
    isPending: false,
  } as never);

  render(
    <SidebarProvider>
      <AppSidebar />
    </SidebarProvider>
  );
}

describe("AppSidebar", () => {
  test("shows the user's name", () => {
    renderSidebar({ name: "Ada Lovelace", email: "ada@example.com" });

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  test("falls back to the email name when the provider has no name", () => {
    renderSidebar({ email: "ada@example.com" });

    expect(screen.getByText("ada")).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });
});
