"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Megaphone, Users } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ImportResult } from "./review-validation";

interface SuccessProps {
  result: ImportResult;
  onClose: () => void;
}

const plural = (count: number) => `${count} ${count === 1 ? "contact" : "contacts"}`;

export function Success({ result, onClose }: SuccessProps) {
  const details = [
    result.updated > 0 && `${plural(result.updated)} updated`,
    result.skipped > 0 && `${plural(result.skipped)} skipped`,
  ].filter(Boolean);

  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <CheckCircle2 className="mb-2 size-6 text-success" />
      <h2 className="text-xl font-semibold tracking-tight">{plural(result.created)} added</h2>
      {details.length > 0 && <p className="text-base text-secondary">{details.join(", ")}.</p>}
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
