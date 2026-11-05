type ErrorBody = {
  error?: string | { message?: string };
  issues?: string[];
};

const statusMessages: Record<number, string> = {
  401: "Your session expired. Sign in again to continue.",
  403: "You don't have permission to do that. Ask an admin for access.",
  404: "We couldn't find that. It may have been deleted. Refresh the page.",
  413: "That's too large to upload. Try a smaller file.",
};

const OFFLINE = "Can't reach Samrian. Check your connection and try again.";
const SERVER = "Something went wrong on our side. Try again in a moment.";

/** Turns a failed response into one short sentence: what happened and what to do next. */
export async function responseError(response: Response, fallback?: string): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as ErrorBody;
  if (body.issues?.length) return body.issues.join(". ");
  const message = typeof body.error === "string" ? body.error : body.error?.message;
  if (response.status === 429) {
    const seconds = Number(response.headers.get("Retry-After"));
    return seconds > 0
      ? `Too many requests. Try again in ${seconds} seconds.`
      : "Too many requests. Wait a moment and try again.";
  }
  if (response.status >= 500) return fallback ? `${fallback}. ${SERVER}` : SERVER;
  return message ?? statusMessages[response.status] ?? fallback ?? SERVER;
}

export async function requestJson<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  }).catch(() => {
    throw new Error(OFFLINE);
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json().catch(() => undefined) as Promise<T>;
}

export function errorMessage(error: unknown, fallback = SERVER): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
