"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { PropertyVaultApiClient } from "@/src/shared/api/client";

const PropertyVaultApiClientContext = createContext<PropertyVaultApiClient | null>(null);

export interface PropertyVaultApiClientProviderProps {
  children: ReactNode;
  client: PropertyVaultApiClient;
}

export function PropertyVaultApiClientProvider({
  children,
  client,
}: PropertyVaultApiClientProviderProps) {
  return (
    <PropertyVaultApiClientContext.Provider value={client}>
      {children}
    </PropertyVaultApiClientContext.Provider>
  );
}

export function usePropertyVaultApiClient() {
  const client = useContext(PropertyVaultApiClientContext);

  if (!client) {
    throw new Error("PropertyVaultApiClientProvider is missing from the app tree.");
  }

  return client;
}
