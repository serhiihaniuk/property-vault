"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { createPropertyVaultApiClient } from "@/src/shared/api/client";
import { PropertyVaultApiClientProvider } from "@/src/shared/api/api-client-provider";
import { createPropertyVaultQueryClient } from "@/src/shared/api/query-client";
import { createPropertyVaultAuthClient } from "@/src/shared/auth/client";
import { PropertyVaultAuthClientProvider } from "@/src/shared/auth/auth-client-provider";
import { ThemeProvider } from "@/src/shared/ui/theme-provider";

export interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => createPropertyVaultQueryClient());
  const [apiClient] = useState(() => createPropertyVaultApiClient());
  const [authClient] = useState(() => createPropertyVaultAuthClient());

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <PropertyVaultAuthClientProvider client={authClient}>
          <PropertyVaultApiClientProvider client={apiClient}>
            {children}
          </PropertyVaultApiClientProvider>
        </PropertyVaultAuthClientProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
