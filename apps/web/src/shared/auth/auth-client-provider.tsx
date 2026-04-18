"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { PropertyVaultAuthClient } from "@/src/shared/auth/client";

const PropertyVaultAuthClientContext = createContext<PropertyVaultAuthClient | null>(null);

export interface PropertyVaultAuthClientProviderProps {
  children: ReactNode;
  client: PropertyVaultAuthClient;
}

export function PropertyVaultAuthClientProvider({
  children,
  client,
}: PropertyVaultAuthClientProviderProps) {
  return (
    <PropertyVaultAuthClientContext.Provider value={client}>
      {children}
    </PropertyVaultAuthClientContext.Provider>
  );
}

export function usePropertyVaultAuthClient() {
  const client = useContext(PropertyVaultAuthClientContext);

  if (!client) {
    throw new Error("PropertyVaultAuthClientProvider is missing from the app tree.");
  }

  return client;
}

export function usePropertyVaultSession() {
  const client = usePropertyVaultAuthClient();

  return client.useSession();
}
