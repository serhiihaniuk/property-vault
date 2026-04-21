import {
  getRuntimePropertyVaultAuth,
  getSessionFromHeaders,
} from "@dabrowskiego/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSessionFromHeaders(
    getRuntimePropertyVaultAuth(),
    await headers(),
  );

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">
        {children}
      </div>
    </div>
  );
}
