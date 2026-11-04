"use client";

import * as React from "react";
import NextLink from "next/link";
import { LinkProvider } from "@astryxdesign/core/Link";
import { Theme } from "@astryxdesign/core/theme";
import { useTheme } from "@/components/theme";
import { Toaster } from "@/components/toaster";
import { samrianTheme } from "@/themes/samrian/samrian.js";

/** Astryx theme (tokens, icons, colour mode) and Next.js routing for Astryx links. */
export function Providers({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <Theme theme={samrianTheme} mode={theme}>
      <LinkProvider component={NextLink}>
        {children}
        <Toaster />
      </LinkProvider>
    </Theme>
  );
}
