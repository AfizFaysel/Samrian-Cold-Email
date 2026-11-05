import * as React from "react";
import { BreadcrumbItem, Breadcrumbs } from "@astryxdesign/core/Breadcrumbs";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  /** Page-level actions, right of the title. At most one primary. */
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
  // The last crumb repeats the title, so only parents are shown.
  const parents = breadcrumbs?.slice(0, -1).filter((crumb) => crumb.href) ?? [];

  return (
    <VStack as="header" gap={2}>
      {parents.length > 0 && (
        <Breadcrumbs variant="supporting">
          {parents.map((crumb) => (
            <BreadcrumbItem key={crumb.label} href={crumb.href}>
              {crumb.label}
            </BreadcrumbItem>
          ))}
          <BreadcrumbItem isCurrent>{title}</BreadcrumbItem>
        </Breadcrumbs>
      )}
      <HStack gap={4} hAlign="between" vAlign="center" wrap="wrap">
        <VStack gap={1}>
          <Heading level={1}>{title}</Heading>
          {description && <Text type="supporting">{description}</Text>}
        </VStack>
        {actions && (
          <HStack gap={2} vAlign="center" wrap="wrap">
            {actions}
          </HStack>
        )}
      </HStack>
    </VStack>
  );
}

/** The frame every dashboard page uses: header, then content, 1200px wide. */
export function Page({
  children,
  className,
  width = "default",
  ...header
}: PageHeaderProps & {
  children: React.ReactNode;
  className?: string;
  width?: "default" | "narrow" | "full";
}) {
  return (
    <VStack
      gap={6}
      width="100%"
      maxWidth={width === "default" ? 1200 : width === "narrow" ? 768 : undefined}
      // Phone gutter is one step tighter than the Astryx LayoutContent padding.
      className={cn("mx-auto p-4 sm:p-6", className)}
    >
      <PageHeader {...header} />
      {children}
    </VStack>
  );
}

/** A titled card section inside a page. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card padding={0} className={cn("flex flex-col overflow-hidden", className)}>
      {(title || actions) && (
        <>
          <HStack gap={4} hAlign="between" vAlign="center" paddingInline={4} paddingBlock={3}>
            <VStack gap={0}>
              {/* Level 3 is the theme's section size (17px); level 2 (20px) outweighs the page. */}
              {title && <Heading level={3}>{title}</Heading>}
              {description && <Text type="supporting">{description}</Text>}
            </VStack>
            {actions && (
              <HStack gap={2} vAlign="center">
                {actions}
              </HStack>
            )}
          </HStack>
          <Divider />
        </>
      )}
      <div className={cn("flex-1", bodyClassName)}>{children}</div>
    </Card>
  );
}
