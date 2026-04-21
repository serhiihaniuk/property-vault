import { InviteAcceptPage } from "@/src/views/invite-accept/ui/invite-accept-page";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }> | { token: string };
}) {
  const resolvedParams = await params;

  return <InviteAcceptPage token={resolvedParams.token} />;
}
