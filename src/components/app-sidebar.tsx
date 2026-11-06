"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import {
  DropdownMenu,
  DropdownMenuDivider,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@astryxdesign/core/DropdownMenu";
import { SideNav, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import {
  BarChart3,
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
import { useApi } from "@/hooks/use-api";
import { signOut, useAuthSession } from "@/lib/auth";
import { THEME_OPTIONS, useTheme, type ThemeChoice } from "@/components/theme";

type NavItem = { title: string; url: string; icon: React.ComponentType };

const NAV_SECTIONS: Array<{ title: string; isHeaderHidden?: boolean; items: NavItem[] }> = [
  {
    title: "Home",
    isHeaderHidden: true,
    items: [
      { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
      { title: "Inbox", url: "/dashboard/inbox", icon: Inbox },
      { title: "Analytics", url: "/dashboard/analytics", icon: BarChart3 },
    ],
  },
  {
    title: "Outreach",
    items: [
      { title: "Campaigns", url: "/dashboard/campaigns", icon: Megaphone },
      { title: "Contacts", url: "/dashboard/contacts", icon: Contact2 },
    ],
  },
  {
    title: "Sending",
    items: [
      { title: "Mailboxes", url: "/dashboard/mailboxes", icon: Mailbox },
      { title: "Blocklist", url: "/dashboard/blocklist", icon: ShieldOff },
    ],
  },
];

function isActive(pathname: string, url: string) {
  if (url === "/dashboard") return pathname === url;
  return pathname === url || pathname.startsWith(`${url}/`);
}

/** Main navigation. Settings sits apart at the bottom; Inbox shows unread replies. */
export function AppSideNav() {
  const pathname = usePathname();
  const inbox = useApi<{ unreadCount: number }>("/api/inbox?limit=1");
  const refetchInbox = inbox.refetch;

  // The nav stays mounted across pages, so refresh the count on each navigation.
  React.useEffect(() => {
    refetchInbox();
  }, [pathname, refetchInbox]);

  const unread = inbox.data?.unreadCount ?? 0;

  return (
    <SideNav
      footer={
        <SideNavSection title="Workspace" isHeaderHidden>
          <SideNavItem
            label="Settings"
            href="/dashboard/settings"
            icon={Settings}
            isSelected={isActive(pathname, "/dashboard/settings")}
          />
        </SideNavSection>
      }
    >
      {NAV_SECTIONS.map((section) => (
        <SideNavSection
          key={section.title}
          title={section.title}
          isHeaderHidden={section.isHeaderHidden}
        >
          {section.items.map((item) => (
            <SideNavItem
              key={item.url}
              label={item.title}
              href={item.url}
              icon={item.icon}
              isSelected={isActive(pathname, item.url)}
              endContent={
                item.url === "/dashboard/inbox" && unread > 0 ? (
                  <Badge variant="blue" label={unread > 99 ? "99+" : String(unread)} />
                ) : undefined
              }
            />
          ))}
        </SideNavSection>
      ))}
    </SideNav>
  );
}

/** The signed-in user: theme, source and license links, and sign out. */
export function AccountMenu() {
  const router = useRouter();
  const { data: session } = useAuthSession();
  const { theme, setTheme } = useTheme();
  // Hosted sign-in (e.g. GitHub via WorkOS) can leave the name empty.
  const displayName = session?.user?.name || session?.user?.email?.split("@")[0] || "Account";
  const sourceUrl = process.env.NEXT_PUBLIC_SOURCE_URL;

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <DropdownMenu
      placement="below"
      alignment="end"
      menuWidth={240}
      header={
        <VStack gap={0} paddingInline={3} paddingBlock={2}>
          <Text weight="medium" maxLines={1}>
            {displayName}
          </Text>
          {session?.user?.email ? (
            <Text type="supporting" maxLines={1}>
              {session.user.email}
            </Text>
          ) : null}
        </VStack>
      }
      renderTrigger={(props) => (
        <Button
          {...props}
          label={`Account menu for ${displayName}`}
          variant="ghost"
          isIconOnly
          icon={
            <Avatar
              name={displayName}
              src={session?.user?.image || undefined}
              size="sm"
              tooltip={false}
            />
          }
        />
      )}
    >
      <DropdownMenuRadioGroup
        label="Theme"
        value={theme}
        onChange={(value) => setTheme(value as ThemeChoice)}
      >
        {THEME_OPTIONS.map((option) => (
          <DropdownMenuRadioItem
            key={option.value}
            value={option.value}
            label={option.label}
            icon={option.icon}
          />
        ))}
      </DropdownMenuRadioGroup>
      <DropdownMenuDivider />
      {sourceUrl ? (
        <DropdownMenuItem label="Source code" icon={Code2} href={sourceUrl} target="_blank" />
      ) : null}
      <DropdownMenuItem label="License" icon={Scale} href="/licensing" />
      <DropdownMenuDivider />
      <DropdownMenuItem label="Sign out" icon={LogOut} onClick={() => void handleSignOut()} />
    </DropdownMenu>
  );
}
