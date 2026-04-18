import type { ReactNode } from "react";

import { AppShell } from "@/src/shared/ui/app-shell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
