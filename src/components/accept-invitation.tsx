"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Logo } from "@/components/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuthSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
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
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-body p-6">
      <Logo className="size-9" />
      <section className="flex w-full max-w-sm flex-col gap-4 rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Join your team on Samrian</h1>

        {isPending ? <p className="text-base text-secondary">Loading…</p> : null}

        {!isPending && !session?.user ? (
          <>
            <p className="text-base text-secondary">
              Sign in with the email address this invitation was sent to.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href={`/sign-in?redirect=${redirect}`}
                className={cn(buttonVariants(), "flex-1")}
              >
                Sign in
              </Link>
              <Link
                href={`/sign-up?redirect=${redirect}`}
                className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
              >
                Create an account
              </Link>
            </div>
          </>
        ) : null}

        {!isPending && session?.user && !needsVerification ? (
          <Button type="button" size="lg" onClick={accept} disabled={isWorking}>
            {isWorking ? "Joining…" : "Accept invitation"}
          </Button>
        ) : null}

        {needsVerification ? (
          <>
            <p className="text-base text-secondary">
              Confirm you own this email address before joining.
            </p>
            <Button type="button" size="lg" onClick={sendVerification}>
              Send verification email
            </Button>
          </>
        ) : null}

        {notice ? <p className="text-base text-secondary">{notice}</p> : null}
        {error ? (
          <p role="alert" className="text-base text-error">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
