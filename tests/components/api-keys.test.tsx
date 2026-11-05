import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiKeys } from "../../src/components/api-keys";

describe("API keys", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("creates a scoped key and shows plaintext once", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(
        Response.json({
          id: "key_1",
          name: "CLI",
          value: "sam_secret",
          scopes: ["contacts:read"],
          createdAt: "2026-07-13T00:00:00.000Z",
        })
      );
    render(<ApiKeys />);

    fireEvent.change(screen.getByLabelText("Key name"), { target: { value: "CLI" } });
    fireEvent.click(screen.getByRole("radio", { name: /Custom/ }));
    // Custom starts from the Read only preset; narrow it to one scope.
    for (const scope of ["identity:read", "groups:read", "campaigns:read", "mailboxes:read"]) {
      fireEvent.click(screen.getByLabelText(scope));
    }
    for (const scope of ["inbox:read", "analytics:read", "domains:read"]) {
      fireEvent.click(screen.getByLabelText(scope));
    }
    fireEvent.click(screen.getByRole("button", { name: "Create key" }));

    expect(await screen.findByText("sam_secret")).toBeInTheDocument();
    expect(screen.getByText(/shown once/i)).toBeInTheDocument();
  });

  it("lists and revokes keys", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json([
          {
            id: "key_1",
            name: "CI",
            scopes: ["contacts:read"],
            createdAt: "2026-07-13T00:00:00.000Z",
          },
        ])
      )
      .mockResolvedValueOnce(Response.json({ revoked: true }))
      .mockResolvedValueOnce(Response.json([]));
    render(<ApiKeys />);

    expect(await screen.findByText("CI")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revoke CI" }));
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(await screen.findByRole("button", { name: "Revoke key" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/settings/api-keys/key_1/revoke",
        expect.objectContaining({ method: "POST" })
      )
    );
  });
});
