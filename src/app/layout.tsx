import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  variable: "--font-geist-sans",
  src: "./fonts/geist-latin.woff2",
  weight: "100 900",
});

const geistMono = localFont({
  variable: "--font-geist-mono",
  src: "./fonts/geist-mono-latin.woff2",
  weight: "100 900",
});

const plusJakarta = localFont({
  variable: "--font-plus-jakarta",
  src: "./fonts/plus-jakarta-sans-latin.woff2",
  weight: "200 800",
});

const ibmPlex = localFont({
  variable: "--font-ibm-plex",
  src: "./fonts/ibm-plex-sans-latin.woff2",
  weight: "100 700",
});

export const metadata: Metadata = {
  title: "Samrian",
  description: "Self-hostable cold email outreach platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${plusJakarta.variable} ${ibmPlex.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
