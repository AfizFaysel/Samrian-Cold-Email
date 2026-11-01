"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuthSession } from "@/lib/auth";
import { authClient } from "@/lib/auth-client";

// Accepting needs a click, so mail scanners that open the link cannot join on someone's behalf.
export function AcceptInvitation({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const { data: session, isPending } = useAuthSession();
  const [isWorking, setIsWorking] = React.useState(false);
  const [needsVerification, setNeedsVerification] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [notice, setNotice] = React.useState<string>();
  const path = `/accept-invitation/${invitationId}`;
  const redirect = encodeURIComponent(path);

  async function accept() {
    setIsWorking(true);
    setError(undefined);
    const result = await authClient.organization.acceptInvitation({ invitationId });
    setIsWorking(false);

    if (result.error) {
      if (result.error.code?.startsWith("EMAIL_VERIFICATION_REQUIRED")) {
        setNeedsVerification(true);
      } else {
        setError(result.error.message ?? "This invitation cannot be accepted");
      }
      return;
    }

    await authClient.organization.setActive({
      organizationId: result.data?.invitation.organizationId,
    });
    router.push("/dashboard");
  }

  async function sendVerification() {
    if (!session?.user?.email) return;
    setError(undefined);
    const result = await authClient.sendVerificationEmail({
      email: session.user.email,
      callbackURL: path,
    });
    if (result.error) setError(result.error.message ?? "Could not send the email");
    else setNotice("Check your inbox, then follow the link to come back here.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">Join your team on Samrian</h1>

        {isPending ? <p className="text-sm text-slate-600">Loading...</p> : null}

        {!isPending && !session?.user ? (
          <>
            <p className="text-sm text-slate-600">
              Sign in with the email address this invitation was sent to.
            </p>
            <div className="flex gap-3 text-sm font-semibold">
              <Link href={`/sign-in?redirect=${redirect}`}>Sign in</Link>
              <Link href={`/sign-up?redirect=${redirect}`}>Create an account</Link>
            </div>
          </>
        ) : null}

        {!isPending && session?.user && !needsVerification ? (
          <button
            type="button"
            onClick={accept}
            disabled={isWorking}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isWorking ? "Joining..." : "Accept invitation"}
          </button>
        ) : null}

        {needsVerification ? (
          <>
            <p className="text-sm text-slate-600">
              Confirm you own this email address before joining.
            </p>
            <button
              type="button"
              onClick={sendVerification}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Send verification email
            </button>
          </>
        ) : null}

        {notice ? <p className="text-sm text-slate-600">{notice}</p> : null}
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
