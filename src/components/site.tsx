import Link from "next/link";
import { Wordmark } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

const sourceUrl = process.env.NEXT_PUBLIC_SOURCE_URL;

/** Header for public pages: landing and licensing. */
export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-body/85 backdrop-blur supports-backdrop-filter:bg-body/70">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center">
          <Wordmark className="h-6" />
        </Link>
        <nav className="hidden items-center gap-5 text-base text-secondary sm:flex">
          <Link href="/#features" className="transition-colors hover:text-primary">
            Features
          </Link>
          <Link href="/#self-host" className="transition-colors hover:text-primary">
            Self-host
          </Link>
          <Link href="/licensing" className="transition-colors hover:text-primary">
            License
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {signedIn ? (
            <Link href="/dashboard" className={buttonVariants()}>
              Open dashboard
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className={buttonVariants({ variant: "ghost" })}>
                Sign in
              </Link>
              <Link href="/sign-up" className={buttonVariants()}>
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("border-t", className)}>
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-8 text-base text-secondary sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <Wordmark className="h-4 text-primary" />
          <span>Open source under AGPL-3.0-or-later</span>
        </div>
        <div className="flex gap-5">
          {sourceUrl ? (
            <a href={sourceUrl} target="_blank" rel="noreferrer" className="hover:text-primary">
              Source
            </a>
          ) : null}
          <Link href="/licensing" className="hover:text-primary">
            License
          </Link>
          <Link href="/sign-in" className="hover:text-primary">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
