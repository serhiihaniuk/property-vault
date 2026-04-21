"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { usePropertyVaultApiClient } from "@/src/shared/api/api-client-provider"
import { PropertyVaultApiError } from "@/src/shared/api/client"
import { StateSurface } from "@/src/shared/ui"
import { Button } from "@/src/shared/ui/button"
import { Input } from "@/src/shared/ui/input"
import { Label } from "@/src/shared/ui/label"
import { ErrorState } from "@/src/shared/ui/state-message"
import {
  Surface,
  SurfaceBody,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceHeading,
  SurfaceTitle,
} from "@/src/shared/ui/surface"
import { StatusBadge } from "@/src/shared/ui/status-badge"

export interface InviteAcceptanceWidgetProps {
  token: string
}

export function InviteAcceptanceWidget({ token }: InviteAcceptanceWidgetProps) {
  const apiClient = usePropertyVaultApiClient()
  const router = useRouter()
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")

  const invitationQuery = useQuery({
    queryFn: () => apiClient.getAccessInvitation({ pathParams: { token } }),
    queryKey: ["access", "invitation", token],
  })
  const acceptMutation = useMutation({
    mutationFn: () =>
      apiClient.acceptAccessInvitation({
        body: {
          name,
          password,
        },
        pathParams: { token },
      }),
    onSuccess: (result) => {
      router.push(result.redirectTo)
      router.refresh()
    },
  })

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    acceptMutation.reset()
    await acceptMutation.mutateAsync()
  }

  if (invitationQuery.isPending) {
    return (
      <StateSurface
        className="w-full max-w-xl"
        description="Loading invitation details so you can create your password and activate access."
        label="Loading invitation"
        rows={6}
        title="Accept invitation"
        variant="loading"
      />
    )
  }

  if (invitationQuery.error) {
    return (
      <StateSurface
        className="w-full max-w-xl"
        description="The invitation details could not be loaded, so access cannot be activated yet."
        stateDescription={getApiErrorMessage(invitationQuery.error)}
        stateTitle="Invitation could not be loaded"
        title="Invitation unavailable"
        variant="error"
      />
    )
  }

  const invitation = invitationQuery.data

  return (
    <Surface className="w-full max-w-xl" tone="elevated">
      <SurfaceHeader>
        <SurfaceHeading>
          <SurfaceTitle>Accept invitation</SurfaceTitle>
          <SurfaceDescription>
            Create your password to activate access for{" "}
            <span className="font-mono">{invitation.email}</span>.
          </SurfaceDescription>
        </SurfaceHeading>
        <StatusBadge dot status={mapInvitationStatus(invitation.status)}>
          {invitation.status}
        </StatusBadge>
      </SurfaceHeader>
      <SurfaceBody className="gap-4">
        <div className="grid gap-1 text-sm text-fg-subtle">
          <span>
            Role: <span className="text-fg-primary">{invitation.role}</span>
          </span>
          <span>
            Expires:{" "}
            <span className="text-fg-primary">
              {formatDateTime(invitation.expiresAt)}
            </span>
          </span>
        </div>

        {!invitation.canAccept ? (
          <ErrorState
            title="Invitation unavailable"
            description="This invite is no longer active. Ask the owner to create a fresh invitation if you still need access."
          />
        ) : (
          <form className="grid gap-3" onSubmit={handleSubmit}>
            <Label htmlFor="invite-name">Name</Label>
            <Input
              id="invite-name"
              autoComplete="name"
              placeholder="Your name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />

            <Label htmlFor="invite-password">Password</Label>
            <Input
              id="invite-password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            {acceptMutation.error ? (
              <ErrorState
                title="Invitation could not be accepted"
                description={getApiErrorMessage(acceptMutation.error)}
              />
            ) : null}

            <div className="flex items-center gap-2 pt-1">
              <Button disabled={acceptMutation.isPending} type="submit">
                {acceptMutation.isPending
                  ? "Creating account"
                  : "Accept invitation"}
              </Button>
            </div>
          </form>
        )}
      </SurfaceBody>
    </Surface>
  )
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function getApiErrorMessage(error: unknown): string {
  if (error instanceof PropertyVaultApiError) {
    return error.problem?.detail ?? error.problem?.title ?? error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return "The invitation request failed."
}

function mapInvitationStatus(status: string) {
  switch (status) {
    case "accepted":
      return "success" as const
    case "expired":
      return "warning" as const
    case "pending":
      return "pending" as const
    case "revoked":
      return "danger" as const
    default:
      return "neutral" as const
  }
}
