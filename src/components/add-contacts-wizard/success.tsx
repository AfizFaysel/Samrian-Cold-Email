"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Megaphone, Users } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

interface SuccessProps {
  contactCount: number;
  onClose: () => void;
}

export function Success({ contactCount, onClose }: SuccessProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <CheckCircle2 className="mb-2 size-6 text-success" />
      <h2 className="text-xl font-semibold tracking-tight">
        {contactCount} {contactCount === 1 ? "contact" : "contacts"} added
      </h2>
      <p className="max-w-md text-base text-secondary">
        They&apos;re in your list now. Start a campaign to reach them, or head back to your
        contacts.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={onClose}>
          <Users data-icon="inline-start" />
          View contacts
        </Button>
        <Link href="/dashboard/campaigns/new" className={buttonVariants()}>
          <Megaphone data-icon="inline-start" />
          Start a campaign
        </Link>
      </div>
    </div>
  );
}
