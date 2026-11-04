import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import { themeScript } from "@/components/theme";
import "./globals.css";

const figtree = localFont({
  variable: "--font-figtree",
  src: "./fonts/figtree-latin.woff2",
  weight: "300 900",
  display: "swap",
});

const geistMono = localFont({
  variable: "--font-geist-mono",
  src: "./fonts/geist-mono-latin.woff2",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: { default: "Samrian", template: "%s · Samrian" },
  description: "Self-hostable cold email outreach platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-astryx-theme="samrian"
      className={`${figtree.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
