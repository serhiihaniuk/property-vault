"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Ban, Copy, Link as LinkIcon, Mail, UserMinus } from "lucide-react"
import { useState } from "react"

import { usePropertyVaultApiClient } from "@/src/shared/api/api-client-provider"
import { usePropertyVaultSession } from "@/src/shared/auth/auth-client-provider"
import {
  PropertyVaultApiError,
  type CreateAccessInvitationData,
} from "@/src/shared/api/client"
import { Button } from "@/src/shared/ui/button"
import { Input } from "@/src/shared/ui/input"
import { Label } from "@/src/shared/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/shared/ui/select"
import { EmptyState, ErrorState } from "@/src/shared/ui/state-message"
import { StateSurface } from "@/src/shared/ui"
import {
  Surface,
  SurfaceBody,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceHeading,
  SurfaceTitle,
} from "@/src/shared/ui/surface"
import { StatusBadge } from "@/src/shared/ui/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/shared/ui/table"

const roleOptions = [
  { label: "Viewer", value: "viewer" },
  { label: "Editor", value: "editor" },
  { label: "Owner", value: "owner" },
] as const

export function AccessManagementWidget() {
  const apiClient = usePropertyVaultApiClient()
  const queryClient = useQueryClient()
  const { data: session } = usePropertyVaultSession()
  const [email, setEmail] = useState("")
  const [role, setRole] =
    useState<(typeof roleOptions)[number]["value"]>("viewer")
  const [latestInvite, setLatestInvite] =
    useState<CreateAccessInvitationData | null>(null)
  const currentUserId = session?.user.id

  const overviewQuery = useQuery({
    queryFn: () => apiClient.getAccessOverview(),
    queryKey: ["access", "overview"],
  })
  const inviteMutation = useMutation({
    mutationFn: () =>
      apiClient.createAccessInvitation({
        body: {
          email,
          role,
        },
      }),
    onSuccess: (result) => {
      setEmail("")
      setLatestInvite(result)
      queryClient.invalidateQueries({ queryKey: ["access", "overview"] })
    },
  })
  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) =>
      apiClient.revokeAccessInvitation({
        pathParams: {
          invitationId,
        },
      }),
    onSuccess: (_result, invitationId) => {
      setLatestInvite((current) =>
        current?.invitation.id === invitationId ? null : current
      )
      queryClient.invalidateQueries({ queryKey: ["access", "overview"] })
    },
  })
  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) =>
      apiClient.removeAccessMember({
        pathParams: {
          memberId,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access", "overview"] })
    },
  })

  async function handleInviteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    inviteMutation.reset()
    await inviteMutation.mutateAsync()
  }

  async function handleRevokeInvitation(invitationId: string) {
    revokeMutation.reset()
    await revokeMutation.mutateAsync(invitationId)
  }

  async function handleRemoveMember(memberId: string) {
    removeMemberMutation.reset()
    await removeMemberMutation.mutateAsync(memberId)
  }

  async function copyLatestInvitePath() {
    if (!latestInvite || typeof window === "undefined") {
      return
    }

    await navigator.clipboard.writeText(
      `${window.location.origin}${latestInvite.invitePath}`
    )
  }

  if (overviewQuery.isPending) {
    return (
      <StateSurface
        description="Loading current members, pending invitations, and the invite-only access ledger."
        label="Loading access overview"
        rows={8}
        title="Access overview"
        variant="loading"
      />
    )
  }

  if (overviewQuery.error) {
    return (
      <StateSurface
        description="Members and invitation records could not be loaded from the auth-backed app data."
        stateDescription={getApiErrorMessage(overviewQuery.error)}
        stateTitle="Access data could not be loaded"
        title="Access overview unavailable"
        variant="error"
      />
    )
  }

  const data = overviewQuery.data
  const pendingInvitations = data.invitations.filter(
    (invitation) => invitation.status === "pending"
  )

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
      <Surface tone="elevated">
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Create invitation</SurfaceTitle>
            <SurfaceDescription>
              Generate a one-time invite link for a named role. Existing active
              invites for the same email are revoked automatically.
            </SurfaceDescription>
          </SurfaceHeading>
        </SurfaceHeader>
        <SurfaceBody>
          <form className="grid gap-3" onSubmit={handleInviteSubmit}>
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="email"
              placeholder="viewer@example.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <Label htmlFor="invite-role">Role</Label>
            <Select
              value={role}
              onValueChange={(value) =>
                setRole(value as (typeof roleOptions)[number]["value"])
              }
            >
              <SelectTrigger id="invite-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            {inviteMutation.error ? (
              <ErrorState
                description={getApiErrorMessage(inviteMutation.error)}
                title="Invitation could not be created"
              />
            ) : null}

            <div className="flex items-center gap-2 pt-1">
              <Button disabled={inviteMutation.isPending} type="submit">
                <Mail className="size-4" />
                {inviteMutation.isPending ? "Creating invite" : "Create invite"}
              </Button>
            </div>
          </form>

          {latestInvite ? (
            <Surface density="dense" tone="muted">
              <SurfaceHeader>
                <SurfaceHeading>
                  <SurfaceTitle>Latest invite</SurfaceTitle>
                  <SurfaceDescription>
                    Copy and share this private link directly with the invited
                    user.
                  </SurfaceDescription>
                </SurfaceHeading>
              </SurfaceHeader>
              <SurfaceBody>
                <div className="rounded-md border border-border-default bg-surface-app px-3 py-2">
                  <div className="flex items-center gap-2 text-sm text-fg-primary">
                    <LinkIcon className="size-4 text-fg-subtle" />
                    <span className="font-mono text-[12px]">
                      {latestInvite.invitePath}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge dot status="pending">
                    {latestInvite.invitation.role}
                  </StatusBadge>
                  <Button
                    onClick={copyLatestInvitePath}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Copy className="size-4" />
                    Copy link
                  </Button>
                </div>
              </SurfaceBody>
            </Surface>
          ) : null}
        </SurfaceBody>
      </Surface>

      <div className="grid gap-4">
        <Surface>
          <SurfaceHeader>
            <SurfaceHeading>
              <SurfaceTitle>Current members</SurfaceTitle>
              <SurfaceDescription>
                Accounts that can sign in to the private workspace right now.
                Non-owner members can be removed here.
              </SurfaceDescription>
            </SurfaceHeading>
          </SurfaceHeader>
          <SurfaceBody>
            {removeMemberMutation.error ? (
              <ErrorState
                description={getApiErrorMessage(removeMemberMutation.error)}
                title="Member could not be removed"
              />
            ) : null}
            {data.members.length === 0 ? (
              <EmptyState
                description="No members have been created yet."
                title="No access members"
              />
            ) : (
              <div className="rounded-md border border-border-default">
                <Table>
                  <TableHeader className="bg-surface-subtle/60">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-3 py-2 text-[11px] tracking-[0.08em] text-fg-subtle uppercase">
                        Name
                      </TableHead>
                      <TableHead className="px-3 py-2 text-[11px] tracking-[0.08em] text-fg-subtle uppercase">
                        Email
                      </TableHead>
                      <TableHead className="px-3 py-2 text-[11px] tracking-[0.08em] text-fg-subtle uppercase">
                        Role
                      </TableHead>
                      <TableHead className="px-3 py-2 text-[11px] tracking-[0.08em] text-fg-subtle uppercase">
                        Created
                      </TableHead>
                      <TableHead className="px-3 py-2 text-[11px] tracking-[0.08em] text-fg-subtle uppercase">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.members.map((member) => (
                      <TableRow
                        key={member.id}
                        className="bg-surface-card hover:bg-surface-card"
                      >
                        <TableCell className="px-3 py-2 text-fg-primary">
                          {member.name}
                        </TableCell>
                        <TableCell className="px-3 py-2 font-mono text-[12px] text-fg-subtle">
                          {member.email}
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <StatusBadge
                            dot
                            status={
                              member.role === "owner" ? "info" : "neutral"
                            }
                          >
                            {member.role}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="px-3 py-2 text-fg-subtle">
                          {formatDateTime(member.createdAt)}
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          {member.role !== "owner" &&
                          member.id !== currentUserId ? (
                            <Button
                              disabled={removeMemberMutation.isPending}
                              onClick={() => void handleRemoveMember(member.id)}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <UserMinus className="size-4" />
                              {removeMemberMutation.isPending &&
                              removeMemberMutation.variables === member.id
                                ? "Removing"
                                : "Remove"}
                            </Button>
                          ) : (
                            <span className="text-[12px] text-fg-subtle">
                              Protected
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SurfaceBody>
        </Surface>

        <Surface>
          <SurfaceHeader>
            <SurfaceHeading>
              <SurfaceTitle>Invitation ledger</SurfaceTitle>
              <SurfaceDescription>
                Pending and historical invites kept in the auth schema for
                auditability. Pending invites can be revoked here.
              </SurfaceDescription>
            </SurfaceHeading>
          </SurfaceHeader>
          <SurfaceBody>
            {data.invitations.length === 0 ? (
              <EmptyState
                description="No invitation records exist yet."
                title="No invitations"
              />
            ) : (
              <>
                {revokeMutation.error ? (
                  <ErrorState
                    description={getApiErrorMessage(revokeMutation.error)}
                    title="Invitation could not be updated"
                  />
                ) : null}
                {pendingInvitations.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {pendingInvitations.map((invitation) => (
                      <StatusBadge key={invitation.id} dot status="pending">
                        {invitation.email}
                      </StatusBadge>
                    ))}
                  </div>
                ) : null}
                <div className="rounded-md border border-border-default">
                  <Table>
                    <TableHeader className="bg-surface-subtle/60">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="px-3 py-2 text-[11px] tracking-[0.08em] text-fg-subtle uppercase">
                          Email
                        </TableHead>
                        <TableHead className="px-3 py-2 text-[11px] tracking-[0.08em] text-fg-subtle uppercase">
                          Role
                        </TableHead>
                        <TableHead className="px-3 py-2 text-[11px] tracking-[0.08em] text-fg-subtle uppercase">
                          Status
                        </TableHead>
                        <TableHead className="px-3 py-2 text-[11px] tracking-[0.08em] text-fg-subtle uppercase">
                          Expires
                        </TableHead>
                        <TableHead className="px-3 py-2 text-[11px] tracking-[0.08em] text-fg-subtle uppercase">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.invitations.map((invitation) => (
                        <TableRow
                          key={invitation.id}
                          className="bg-surface-card hover:bg-surface-card"
                        >
                          <TableCell className="px-3 py-2 font-mono text-[12px] text-fg-primary">
                            {invitation.email}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-fg-subtle">
                            {invitation.role}
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <StatusBadge
                              dot
                              status={mapInvitationStatus(invitation.status)}
                            >
                              {invitation.status}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-fg-subtle">
                            {formatDateTime(invitation.expiresAt)}
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            {invitation.status === "pending" ? (
                              <Button
                                disabled={revokeMutation.isPending}
                                onClick={() =>
                                  void handleRevokeInvitation(invitation.id)
                                }
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                <Ban className="size-4" />
                                {revokeMutation.isPending &&
                                revokeMutation.variables === invitation.id
                                  ? "Revoking"
                                  : "Revoke"}
                              </Button>
                            ) : (
                              <span className="text-[12px] text-fg-subtle">
                                No actions
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </SurfaceBody>
        </Surface>
      </div>
    </div>
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

  return "The request could not be completed."
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
