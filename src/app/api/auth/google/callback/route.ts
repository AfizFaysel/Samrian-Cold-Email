import { NextRequest } from "next/server";
import { requireActiveOrg } from "@/server/auth";
import { validateOAuthState } from "../../../../../../lib/oauth-state";
import {
  accessRedirect,
  authorizeOAuthMailbox,
  errorRedirect,
  exchangeCodeForTokens,
  saveOAuthMailbox,
  successRedirect,
  getStateCookieName,
} from "../../../../../../lib/oauth-helpers";
import { withPublicLimit } from "@/server/limits/http";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";

export async function GET(request: NextRequest) {
  return withPublicLimit(request, "oauth.google.callback", (limitedRequest) =>
    callback(limitedRequest as NextRequest)
  );
}

async function callback(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const { searchParams } = request.nextUrl;

  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const errorParam = searchParams.get("error");

  // Handle Google-side errors
  if (errorParam) {
    return errorRedirect(appUrl, errorParam, "google");
  }

  if (!code || !stateParam) {
    return errorRedirect(appUrl, "missing_code_or_state", "google");
  }

  // Validate state cookie exists (CSRF layer 1)
  const cookieName = getStateCookieName("google");
  const storedState = request.cookies.get(cookieName)?.value;
  if (!storedState) {
    return errorRedirect(appUrl, "missing_state_cookie", "google");
  }

  // Cookie must match the URL state param
  if (storedState !== stateParam) {
    return errorRedirect(appUrl, "state_cookie_mismatch", "google");
  }

  let session;
  try {
    session = await requireActiveOrg();
  } catch {
    return errorRedirect(appUrl, "session_expired", "google");
  }

  // Validate signed state (CSRF layer 2 — signature, timestamp, org/user binding)
  let validatedState;
  try {
    validatedState = validateOAuthState(stateParam, session.orgId, session.userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid_state";
    return errorRedirect(appUrl, message, "google");
  }

  try {
    await authorizeOAuthMailbox("google", validatedState.mailboxId);
  } catch (error) {
    return accessRedirect(appUrl, error, "google");
  }

  // Validate env
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return errorRedirect(appUrl, "missing_google_config", "google");
  }

  const redirectUri = `${appUrl}/api/auth/google/callback`;

  // Exchange code for tokens
  let tokens;
  try {
    tokens = await exchangeCodeForTokens(GOOGLE_TOKEN_URL, {
      code,
      clientId,
      clientSecret,
      redirectUri,
    });
  } catch {
    return errorRedirect(appUrl, "token_exchange_failed", "google");
  }

  // Gmail's profile works with the Gmail scopes; userinfo would need the extra email scope.
  let userEmail: string | undefined;
  try {
    const profileResponse = await fetch(GMAIL_PROFILE_URL, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (profileResponse.ok) {
      const profile: unknown = await profileResponse.json();
      const emailAddress = (profile as { emailAddress?: unknown } | null)?.emailAddress;
      if (typeof emailAddress === "string") userEmail = emailAddress;
    }
  } catch {
    // Non-fatal — proceed without email
  }

  // Encrypt + save through Postgres mailbox repo.
  try {
    await saveOAuthMailbox({
      provider: "google",
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      userEmail,
      mailboxId: validatedState.mailboxId,
    });
  } catch {
    return errorRedirect(appUrl, "failed_to_save_mailbox", "google");
  }

  return successRedirect(appUrl, "google");
}
