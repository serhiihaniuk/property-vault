"use client";

import type { ReactNode } from "react";

import { AppProviders } from "@/src/shared/providers/app-providers";

export default function Providers({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
