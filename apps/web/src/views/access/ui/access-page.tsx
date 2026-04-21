"use client";

import { LogOut, ShieldUser } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { usePropertyVaultSession } from "@/src/shared/auth/auth-client-provider";
import { Button } from "@/src/shared/ui/button";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderHeading,
  PageHeaderTitle,
} from "@/src/shared/ui/page-header";
import { StatusBadge } from "@/src/shared/ui/status-badge";
import { AppShell, AppShellMain } from "@/src/shared/ui/app-shell";
import { LoadingInline } from "@/src/shared/ui/state-message";
import { AccessManagementWidget } from "@/src/widgets/access-management/ui/access-management-widget";

export function AccessPage() {
  const router = useRouter();
  const { data: session, isPending } = usePropertyVaultSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const sessionRole =
    (session?.user as { role?: string | null } | undefined)?.role ?? "viewer";

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await fetch("/api/auth/sign-out", {
        credentials: "include",
        method: "POST",
      });
    } finally {
      router.push("/sign-in");
      router.refresh();
      setIsSigningOut(false);
    }
  }

  return (
    <AppShell>
      <AppShellMain className="max-w-6xl">
        <PageHeader>
          <PageHeaderHeading>
            <PageHeaderEyebrow>Private workspace</PageHeaderEyebrow>
            <PageHeaderTitle>Access management</PageHeaderTitle>
            <PageHeaderDescription>
              Invite collaborators, inspect current members, and keep the app invite-only.
            </PageHeaderDescription>
          </PageHeaderHeading>
          <PageHeaderActions>
            {isPending ? (
              <LoadingInline label="Loading session" />
            ) : session?.user ? (
              <>
                <StatusBadge status="info" dot>
                  {sessionRole}
                </StatusBadge>
                <span className="inline-flex items-center gap-2 rounded-md border border-border-default bg-surface-card px-3 py-2 text-sm text-fg-subtle">
                  <ShieldUser className="size-4 text-fg-subtle" />
                  <span className="font-mono text-[12px] text-fg-primary">
                    {session.user.email}
                  </span>
                </span>
              </>
            ) : null}
            <Button
              onClick={handleSignOut}
              size="sm"
              variant="outline"
              disabled={isSigningOut}
            >
              <LogOut className="size-4" />
              {isSigningOut ? "Signing out" : "Sign out"}
            </Button>
          </PageHeaderActions>
        </PageHeader>

        <AccessManagementWidget />
      </AppShellMain>
    </AppShell>
  );
}
