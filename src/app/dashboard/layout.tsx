"use client";

import * as React from "react";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationsBell } from "@/components/notifications";
import { Logo } from "@/components/logo";
import { ensureActiveOrganization, useAuthSession } from "@/lib/auth";
import { Loader2 } from "lucide-react";

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
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-body">
        <Logo className="size-9" />
        <Loader2 className="size-4 animate-spin text-secondary" aria-label="Loading" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        {/* Phones only: the sidebar is a drawer there, so it needs an opener. */}
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 bg-body/85 px-3 backdrop-blur supports-backdrop-filter:bg-body/70 md:hidden">
          <SidebarTrigger className="text-secondary" />
          <Logo className="size-6" />
          <span className="text-base font-semibold">Samrian</span>
          <div className="ml-auto">
            <NotificationsBell />
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
