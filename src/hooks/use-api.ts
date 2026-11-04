"use client";

import * as React from "react";

export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`Request failed: ${status}`);
    this.name = "ApiError";
  }
}

type ApiState<T> = {
  url: string | null;
  data?: T;
  error?: Error;
  isLoading: boolean;
};

/**
 * Fetches JSON for a page. A falsy url skips the request. Data stays on screen while a
 * refetch runs, and is dropped only when the url changes.
 */
export function useApi<T>(url: string | null | undefined) {
  const target = url || null;
  const [version, setVersion] = React.useState(0);
  const [state, setState] = React.useState<ApiState<T>>({
    url: target,
    isLoading: target !== null,
  });

  // Reset during render when the url changes so stale data never shows for a new resource.
  if (state.url !== target) {
    setState({ url: target, isLoading: target !== null });
  }

  React.useEffect(() => {
    if (!target) return;
    let cancelled = false;
    setState((current) =>
      current.url === target && current.isLoading && !current.error
        ? current
        : { ...current, isLoading: true, error: undefined }
    );

    fetch(target)
      .then((response) => {
        if (!response.ok) throw new ApiError(response.status);
        return response.json() as Promise<T>;
      })
      .then((data) => {
        if (!cancelled) setState({ url: target, data, isLoading: false });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const error = cause instanceof Error ? cause : new Error("Request failed");
        setState((current) => ({ ...current, error, isLoading: false }));
      });

    return () => {
      cancelled = true;
    };
  }, [target, version]);

  const refetch = React.useCallback(() => setVersion((current) => current + 1), []);

  return {
    data: state.url === target ? state.data : undefined,
    error: state.url === target ? state.error : undefined,
    isLoading: state.url === target ? state.isLoading : target !== null,
    refetch,
  };
}
