"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ChevronsUpDown,
  Code2,
  Contact2,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mailbox,
  Megaphone,
  Scale,
  Settings,
  ShieldOff,
} from "lucide-react";
import { signOut, useAuthSession } from "@/lib/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme";
import { Logo } from "@/components/logo";
import { NotificationsBell } from "@/components/notifications";

type NavItem = { title: string; url: string; icon: React.ComponentType };

const navGroups: Array<{ label?: string; items: NavItem[] }> = [
  {
    items: [
      { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
      { title: "Inbox", url: "/dashboard/inbox", icon: Inbox },
      { title: "Analytics", url: "/dashboard/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Outreach",
    items: [
      { title: "Campaigns", url: "/dashboard/campaigns", icon: Megaphone },
      { title: "Contacts", url: "/dashboard/contacts", icon: Contact2 },
    ],
  },
  {
    label: "Sending",
    items: [
      { title: "Mailboxes", url: "/dashboard/mailboxes", icon: Mailbox },
      { title: "Blocklist", url: "/dashboard/blocklist", icon: ShieldOff },
      { title: "Settings", url: "/dashboard/settings", icon: Settings },
    ],
  },
];

function isActive(pathname: string, url: string) {
  if (url === "/dashboard") return pathname === url;
  return pathname === url || pathname.startsWith(`${url}/`);
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useAuthSession();
  // Hosted sign-in (e.g. GitHub via WorkOS) can leave the name empty.
  const displayName = session?.user?.name || session?.user?.email?.split("@")[0];
  const sourceUrl = process.env.NEXT_PUBLIC_SOURCE_URL;

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <Sidebar className="border-border">
      <SidebarHeader className="flex-row items-center justify-between px-3 pt-4 pb-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-md px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Logo className="size-7" />
          <span className="text-base font-semibold tracking-tight">Samrian</span>
        </Link>
        {/* On phones the bell lives in the top bar instead. */}
        <div className="max-md:hidden">
          <NotificationsBell />
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-1">
        {navGroups.map((group, index) => (
          <SidebarGroup key={group.label ?? index} className="py-1.5">
            {group.label && (
              <SidebarGroupLabel className="h-7 text-sm font-medium text-secondary">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      isActive={isActive(pathname, item.url)}
                      render={<Link href={item.url} />}
                      className="h-8 gap-2.5 rounded-md px-2.5 text-secondary hover:text-primary data-active:font-medium data-active:text-primary [&_svg]:size-4"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-accent data-popup-open:bg-muted"
            aria-label="Account menu"
          >
            <Avatar className="size-8 rounded-md">
              <AvatarImage src={session?.user?.image || ""} alt={displayName || "User"} />
              <AvatarFallback className="rounded-md bg-muted text-sm font-semibold text-secondary">
                {displayName?.substring(0, 2).toUpperCase() || "ME"}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-base font-medium">{displayName || "Loading…"}</span>
              <span className="truncate text-sm text-secondary">{session?.user?.email || "…"}</span>
            </div>
            <ChevronsUpDown className="size-4 shrink-0 text-secondary" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center justify-between gap-2">
                <span>Theme</span>
                <ThemeToggle />
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {sourceUrl ? (
              <DropdownMenuItem render={<a href={sourceUrl} target="_blank" rel="noreferrer" />}>
                <Code2 />
                Source code
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem render={<Link href="/licensing" />}>
              <Scale />
              License
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
