"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  createOrganization,
  isGoogleSignInAvailable,
  isHostedAuth,
  setActiveOrganization,
  signInWithGoogle,
  signUpWithEmail,
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

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [orgName, setOrgName] = React.useState("");
  const [orgSlug, setOrgSlug] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);
  const googleSignInAvailable = isGoogleSignInAvailable();

  if (isHostedAuth()) {
    return <HostedAuth mode="sign-up" />;
  }

  const generateSlug = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Step 1: Sign up user
      const signUpResult = await signUpWithEmail({
        email,
        password,
        name,
      });

      if (signUpResult.error) {
        toast.error(signUpResult.error.message || "Sign-up failed");
        return;
      }

      // Step 2: Create the organization and set it as active
      if (orgName.trim()) {
        try {
          const orgResult = await createOrganization({
            name: orgName.trim(),
            slug: orgSlug || generateSlug(orgName),
          });

          // Set the newly created org as the active one on the session
          if (orgResult.data?.id) {
            await setActiveOrganization(orgResult.data.id);
          }
        } catch {
          // Org creation failure is non-blocking
          console.warn("Organization creation failed, user can create one later.");
        }
      }

      toast.success("Account created successfully!");
      router.push(safeRedirectPath(window.location.search));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-up failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);

    try {
      const result = await signInWithGoogle({ mode: "sign-up" });

      if (result.error) {
        toast.error(result.error.message || "Google sign-up failed");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-up failed");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      description="Set up your workspace and connect your first mailbox in a few minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Ada Lovelace"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Work email</Label>
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
              minLength={8}
              autoComplete="new-password"
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
          <p className="text-sm text-secondary">At least 8 characters.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="orgName">Workspace name</Label>
            <Input
              id="orgName"
              name="orgName"
              type="text"
              required
              placeholder="Acme Corp"
              value={orgName}
              onChange={(e) => {
                setOrgName(e.target.value);
                setOrgSlug(generateSlug(e.target.value));
              }}
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="orgSlug">Workspace ID</Label>
            <Input
              id="orgSlug"
              name="orgSlug"
              type="text"
              required
              placeholder="acme-corp"
              value={orgSlug}
              onChange={(e) => setOrgSlug(generateSlug(e.target.value))}
              className="h-10"
            />
          </div>
        </div>

        <Button type="submit" size="lg" className="mt-2 h-10 w-full" disabled={isLoading}>
          {isLoading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <AuthDivider />

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-10 w-full"
        onClick={handleGoogleSignUp}
        disabled={!googleSignInAvailable || isGoogleLoading}
        title={googleSignInAvailable ? undefined : "Google sign-in is not configured"}
      >
        <Image src="/logos/google.svg" alt="" width={16} height={16} />
        {isGoogleLoading ? "Connecting to Google…" : "Continue with Google"}
      </Button>
    </AuthShell>
  );
}
