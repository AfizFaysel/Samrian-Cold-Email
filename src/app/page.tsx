"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Landing } from "@/components/landing";
import { useAuthSession } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  const { data: session } = useAuthSession();
  const signedIn = Boolean(session?.user);

  useEffect(() => {
    if (signedIn) router.replace("/dashboard");
  }, [signedIn, router]);

  return <Landing signedIn={signedIn} />;
}
