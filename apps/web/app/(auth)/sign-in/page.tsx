import { SignInPage } from "@/src/views/sign-in/ui/sign-in-page";

export default async function SignInRoute({
  searchParams,
}: {
  searchParams:
    | Promise<{ accepted?: string; email?: string }>
    | { accepted?: string; email?: string };
}) {
  const resolvedSearchParams = await searchParams;

  return (
    <SignInPage
      accepted={resolvedSearchParams.accepted === "1"}
      initialEmail={resolvedSearchParams.email ?? ""}
    />
  );
}
