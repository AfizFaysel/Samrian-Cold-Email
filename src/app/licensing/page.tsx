import { ExternalLink } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site";

const sourceUrl = process.env.NEXT_PUBLIC_SOURCE_URL;

export default function LicensingPage() {
  return (
    <div className="flex min-h-svh flex-col bg-body">
      <SiteHeader />
      <main className="flex-1 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-medium text-accent">Licensing</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Open source licensing</h1>
          <p className="mt-5 max-w-2xl text-lg leading-7 text-secondary">
            Samrian application and server code use Apache-2.0. Contracts, SDK, CLI, and MCP
            packages use MIT licenses so integrations remain easy to adopt.
          </p>

          <section className="mt-12 border-t border-border pt-8">
            <h2 className="text-xl font-semibold">Application source</h2>
            <p className="mt-3 leading-7 text-secondary">
              Samrian is open source. Use it, change it, and host it, commercially or not.
            </p>
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 font-medium text-accent hover:underline"
              >
                View source
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : (
              <p className="mt-4 text-base text-secondary">
                This deployment has not linked its source.
              </p>
            )}
          </section>

          <section className="mt-10 border-t border-border pt-8">
            <h2 className="text-xl font-semibold">Brand use</h2>
            <p className="mt-3 leading-7 text-secondary">
              Forks may describe themselves as based on Samrian, but should use distinct names and
              branding. Full license and trademark policy ship with the source distribution.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
