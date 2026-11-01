"use client";

import * as React from "react";

import { AcceptInvitation } from "@/components/accept-invitation";

export default function AcceptInvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  return <AcceptInvitation invitationId={id} />;
}
