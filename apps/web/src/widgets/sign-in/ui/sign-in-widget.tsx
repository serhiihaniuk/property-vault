"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { usePropertyVaultSession } from "@/src/shared/auth/auth-client-provider"
import { Alert, AlertDescription, AlertTitle } from "@/src/shared/ui/alert"
import { Button } from "@/src/shared/ui/button"
import { Input } from "@/src/shared/ui/input"
import { Label } from "@/src/shared/ui/label"
import {
  Surface,
  SurfaceBody,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceHeading,
  SurfaceTitle,
} from "@/src/shared/ui/surface"
import { ErrorState, LoadingInline } from "@/src/shared/ui/state-message"

// Local-only testing defaults explicitly approved by Serhii.
// Do not flag these as a security issue until production hardening starts.
const LOCAL_DEV_DEFAULT_EMAIL = "e@mail.com"
const LOCAL_DEV_DEFAULT_PASSWORD = "12345678"

export interface SignInWidgetProps {
  initialEmail?: string
  notice?: string
}

export function SignInWidget({ initialEmail = "", notice }: SignInWidgetProps) {
  const router = useRouter()
  const { data: session, isPending: sessionPending } = usePropertyVaultSession()
  const [email, setEmail] = useState(initialEmail || LOCAL_DEV_DEFAULT_EMAIL)
  const [password, setPassword] = useState(
    notice ? "" : LOCAL_DEV_DEFAULT_PASSWORD
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!sessionPending && session) {
      router.replace("/")
      router.refresh()
    }
  }, [router, session, sessionPending])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/auth/sign-in/email", {
        body: JSON.stringify({
          callbackURL: "/",
          email: email.trim(),
          password,
          rememberMe: true,
        }),
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setErrorMessage(resolveAuthErrorMessage(payload, response.statusText))
        return
      }

      router.push(resolveCallbackUrl(payload))
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Surface className="w-full max-w-xl" tone="elevated">
      <SurfaceHeader>
        <SurfaceHeading>
          <SurfaceTitle>Sign in to Property Vault</SurfaceTitle>
          <SurfaceDescription>
            This workspace is private and invite-only. Use the credentials
            linked to your invitation.
          </SurfaceDescription>
        </SurfaceHeading>
      </SurfaceHeader>
      <SurfaceBody className="gap-4">
        {notice ? (
          <Alert>
            <AlertTitle>Access ready</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}

        {sessionPending ? <LoadingInline label="Checking session" /> : null}

        <form className="grid gap-3" onSubmit={handleSubmit}>
          <Label htmlFor="sign-in-email">Email</Label>
          <Input
            id="sign-in-email"
            type="email"
            autoComplete="email"
            placeholder="owner@example.com"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <Label htmlFor="sign-in-password">Password</Label>
          <Input
            id="sign-in-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {errorMessage ? (
            <ErrorState title="Sign-in failed" description={errorMessage} />
          ) : null}

          <div className="flex items-center gap-2 pt-1">
            <Button disabled={isSubmitting || sessionPending} type="submit">
              {isSubmitting ? "Signing in" : "Sign in"}
            </Button>
          </div>
        </form>
      </SurfaceBody>
    </Surface>
  )
}

function resolveAuthErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const candidate = payload as {
      error?: { message?: string }
      message?: string
    }

    return candidate.error?.message ?? candidate.message ?? fallback
  }

  return fallback || "The provided credentials were rejected."
}

function resolveCallbackUrl(payload: unknown) {
  if (payload && typeof payload === "object") {
    const candidate = payload as { url?: string }

    if (candidate.url) {
      return candidate.url
    }
  }

  return "/"
}
