"use client"

import { useSyncExternalStore } from "react"

export type TimeRange = "6m" | "12m" | "24m" | "all"

export function extractTime(value: string): string {
  if (!value.includes("T")) {
    return value
  }

  return value.split("T")[1]?.slice(0, 5) ?? value
}

export function useClientReady(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    getClientSnapshot,
    getServerSnapshot
  )
}

function subscribeNoop(): () => void {
  return () => undefined
}

function getClientSnapshot(): boolean {
  return true
}

function getServerSnapshot(): boolean {
  return false
}
