import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
    <header className="flex flex-col gap-2">
      {parents.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-secondary">
          {parents.map((crumb) => (
            <React.Fragment key={crumb.label}>
              <Link href={crumb.href!} className="transition-colors hover:text-primary">
                {crumb.label}
              </Link>
              <ChevronRight className="size-3" aria-hidden />
            </React.Fragment>
          ))}
          <span className="text-primary">{title}</span>
        </nav>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl leading-8 font-semibold tracking-tight">{title}</h1>
          {description && <p className="max-w-2xl text-base text-secondary">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
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
    <div
      className={cn(
        // Astryx LayoutContent: padding step 6, header-to-content gap step 6.
        "mx-auto flex w-full flex-col gap-6 p-4 sm:p-6",
        width === "default" && "max-w-[1200px]",
        width === "narrow" && "max-w-3xl",
        className
      )}
    >
      <PageHeader {...header} />
      {children}
    </div>
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
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border bg-card text-primary",
        className
      )}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
          <div className="flex min-w-0 flex-col">
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && <p className="text-sm text-secondary">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}
