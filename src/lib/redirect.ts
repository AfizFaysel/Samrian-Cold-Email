// The target comes from the URL, so only same-site paths are followed.
export function safeRedirectPath(search: string): string {
  const target = new URLSearchParams(search).get("redirect");
  return target && /^\/(?![/\\])/.test(target) ? target : "/dashboard";
}
