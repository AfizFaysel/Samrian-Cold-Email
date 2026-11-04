"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  isGoogleSignInAvailable,
  isHostedAuth,
  signInWithEmail,
  signInWithGoogle,
} from "@/lib/auth";
import { HostedAuth } from "@/components/hosted-auth";
import { toast } from "sonner";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { AuthDivider, AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeRedirectPath } from "@/lib/redirect";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);
  const googleSignInAvailable = isGoogleSignInAvailable();

  if (isHostedAuth()) {
    return <HostedAuth mode="sign-in" />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signInWithEmail({
        email,
        password,
      });

      if (result.error) {
        toast.error(result.error.message || "Sign-in failed");
      } else {
        router.push(safeRedirectPath(window.location.search));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);

    try {
      const result = await signInWithGoogle({ mode: "sign-in" });

      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in failed");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your outreach workspace."
      footer={
        <>
          New to Samrian?{" "}
          <Link href="/sign-up" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-sm text-secondary hover:text-primary"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" size="lg" className="mt-2 h-10 w-full" disabled={isLoading}>
          {isLoading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <AuthDivider />

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-10 w-full"
        onClick={handleGoogleSignIn}
        disabled={!googleSignInAvailable || isGoogleLoading}
        title={googleSignInAvailable ? undefined : "Google sign-in is not configured"}
      >
        <Image src="/logos/google.svg" alt="" width={16} height={16} />
        {isGoogleLoading ? "Connecting to Google…" : "Continue with Google"}
      </Button>
    </AuthShell>
  );
}
