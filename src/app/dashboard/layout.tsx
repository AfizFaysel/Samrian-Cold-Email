"use client";

import * as React from "react";
import { AppShell } from "@astryxdesign/core/AppShell";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Spinner } from "@astryxdesign/core/Spinner";
import { TopNav } from "@astryxdesign/core/TopNav";
import { VStack } from "@astryxdesign/core/VStack";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { AccountMenu, AppSideNav } from "@/components/app-sidebar";
import { NotificationsBell } from "@/components/notifications";
import { Logo, Wordmark } from "@/components/logo";
import { ensureActiveOrganization, useAuthSession } from "@/lib/auth";

/**
 * Ensures the user has an active organization on their session.
 * If not, fetches their orgs and auto-activates the first one.
 */
function useEnsureActiveOrg() {
  const [ready, setReady] = React.useState(false);
  const { data: session } = useAuthSession();
  const attempted = React.useRef(false);

  React.useEffect(() => {
    // Already have an active org — good to go
    if (session?.session?.activeOrganizationId) {
      setReady(true);
      return;
    }

    // Session loaded but no active org — try to set one
    if (session?.user && !session?.session?.activeOrganizationId && !attempted.current) {
      attempted.current = true;

      ensureActiveOrganization(session)
        .then(() => setReady(true))
        .catch(() => {
          // Even if it fails, let the page load — it'll show empty state
          setReady(true);
        });
    }
  }, [session?.user, session?.session?.activeOrganizationId]);

  return ready;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isPending, user } = useAuthGuard();
  const orgReady = useEnsureActiveOrg();

  if (isPending || (user && !orgReady)) {
    return (
      <VStack gap={4} hAlign="center" vAlign="center" minHeight="100svh" className="bg-body">
        <Logo className="size-9" />
        <Spinner aria-label="Loading" />
      </VStack>
    );
  }

  if (!user) {
    return null;
  }

  return (
    // Astryx shell: brand, bell and account in the top bar; on phones the side nav becomes
    // a drawer opened from that bar. AppShell also renders the skip link and <main>.
    <AppShell
      height="fill"
      variant="section"
      contentPadding={0}
      topNav={
        <TopNav
          label="Samrian"
          heading={
            <Link href="/dashboard" label="Samrian overview">
              <Wordmark className="h-6" />
            </Link>
          }
          endContent={
            <HStack gap={1} vAlign="center">
              <NotificationsBell />
              <AccountMenu />
            </HStack>
          }
        />
      }
      sideNav={<AppSideNav />}
    >
      {children}
    </AppShell>
  );
}
