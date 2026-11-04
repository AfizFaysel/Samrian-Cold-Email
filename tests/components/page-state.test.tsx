import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { EmptyState, ErrorState, LoadingState } from "../../src/components/page-state";
import { StatusBadge } from "../../src/components/status-badge";

describe("ErrorState", () => {
  test("explains the failure and retries", () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load this page");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("names what failed", () => {
    render(<ErrorState title="Couldn't load campaigns" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load campaigns");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  test("shows a title, description and action", () => {
    render(
      <EmptyState
        title="No campaigns yet"
        description="Create one to start."
        action={<button type="button">New campaign</button>}
      />
    );

    expect(screen.getByText("No campaigns yet")).toBeInTheDocument();
    expect(screen.getByText("Create one to start.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New campaign" })).toBeInTheDocument();
  });
});

describe("LoadingState", () => {
  test("announces loading to assistive tech", () => {
    render(<LoadingState label="Loading campaigns" />);

    // Astryx mounts its own live region, so find ours by its text.
    expect(screen.getByText("Loading campaigns").closest('[role="status"]')).toBeInTheDocument();
  });
});

describe("StatusBadge", () => {
  test("pairs every status with a word", () => {
    render(<StatusBadge status="bounced" />);

    expect(screen.getByText("Bounced")).toBeInTheDocument();
  });

  test("labels unknown statuses readably", () => {
    render(<StatusBadge status="needs_review" />);

    expect(screen.getByText("Needs review")).toBeInTheDocument();
  });
});
