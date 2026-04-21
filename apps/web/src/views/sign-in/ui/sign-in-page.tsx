import { AppShell, AppShellMain } from "@/src/shared/ui/app-shell";
import { SignInWidget } from "@/src/widgets/sign-in/ui/sign-in-widget";

export interface SignInPageProps {
  accepted?: boolean;
  initialEmail?: string;
}

export function SignInPage({
  accepted = false,
  initialEmail = "",
}: SignInPageProps) {
  return (
    <AppShell>
      <AppShellMain className="flex min-h-svh max-w-3xl items-center justify-center py-10">
        <SignInWidget
          initialEmail={initialEmail}
          notice={
            accepted
              ? "Invitation accepted. Sign in with the password you just created."
              : undefined
          }
        />
      </AppShellMain>
    </AppShell>
  );
}
