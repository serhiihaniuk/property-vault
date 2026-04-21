"use client";

import { AppShell, AppShellMain } from "@/src/shared/ui/app-shell";
import { InviteAcceptanceWidget } from "@/src/widgets/invite-acceptance/ui/invite-acceptance-widget";

export interface InviteAcceptPageProps {
  token: string;
}

export function InviteAcceptPage({ token }: InviteAcceptPageProps) {
  return (
    <AppShell>
      <AppShellMain className="flex min-h-svh max-w-3xl items-center justify-center py-10">
        <InviteAcceptanceWidget token={token} />
      </AppShellMain>
    </AppShell>
  );
}
