"use client"

import { useSyncExternalStore } from "react"

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
