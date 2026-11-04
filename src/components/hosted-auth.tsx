import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

type HostedAuthProps = {
  mode: "sign-in" | "sign-up";
};

export function HostedAuth({ mode }: HostedAuthProps) {
  const signingUp = mode === "sign-up";
  const href = signingUp ? "/api/auth/workos/sign-up" : "/api/auth/workos/sign-in";

  return (
    <AuthShell
      title={signingUp ? "Create your account" : "Welcome back"}
      description={
        signingUp
          ? "Set up your workspace and connect your first mailbox in a few minutes."
          : "Sign in to your outreach workspace."
      }
      footer={
        signingUp ? (
          <>
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium text-accent hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to Samrian?{" "}
            <Link href="/sign-up" className="font-medium text-accent hover:underline">
              Create an account
            </Link>
          </>
        )
      }
    >
      <div className="flex flex-col gap-3">
        <a href={href} className={cn(buttonVariants({ size: "lg" }), "h-10 w-full")}>
          Continue with WorkOS
          <ArrowRight data-icon="inline-end" />
        </a>
        <p className="text-sm text-secondary">
          You&apos;ll continue on our secure sign-in page, where Google, GitHub and email options
          are available.
        </p>
      </div>
    </AuthShell>
  );
}
