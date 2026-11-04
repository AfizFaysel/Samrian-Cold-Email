import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { useApi } from "../../src/hooks/use-api";

function respond(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useApi", () => {
  test("loads data and stops loading", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => respond(200, { items: [1] }))
    );

    const { result } = renderHook(() => useApi<{ items: number[] }>("/api/items"));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ items: [1] });
    expect(result.current.error).toBeUndefined();
  });

  test("reports a failed request instead of loading forever", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => respond(500, { error: "boom" }))
    );

    const { result } = renderHook(() => useApi("/api/items"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeInstanceOf(Error);
  });

  test("reports a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("offline")))
    );

    const { result } = renderHook(() => useApi("/api/items"));

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.isLoading).toBe(false);
  });

  test("retries after an error and clears it on success", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => respond(503, {}))
      .mockImplementation(() => respond(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useApi<{ ok: boolean }>("/api/items"));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));

    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.data).toEqual({ ok: true }));
    expect(result.current.error).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("keeps showing data while it refreshes", async () => {
    let resolveSecond: (value: Response) => void = () => {};
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => respond(200, { n: 1 }))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSecond = resolve;
          })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useApi<{ n: number }>("/api/items"));
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));

    act(() => result.current.refetch());

    expect(result.current.data).toEqual({ n: 1 });
    await act(async () => resolveSecond(new Response(JSON.stringify({ n: 2 }))));
    await waitFor(() => expect(result.current.data).toEqual({ n: 2 }));
  });

  test("does not fetch without a url", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useApi(null));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});
