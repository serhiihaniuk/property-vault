import {
  DatabaseZap,
  FileCheck2,
  ShieldCheck,
  Waypoints,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/shared/ui/card";
import { Separator } from "@/src/shared/ui/separator";

const operatingPrinciples = [
  {
    title: "Local-first evidence",
    description:
      "Canonical documents stay in the vault while the app consumes structured data after sync.",
    Icon: FileCheck2,
  },
  {
    title: "Invite-only access",
    description:
      "Routes are private by default and access is expected to flow through the auth layer.",
    Icon: ShieldCheck,
  },
  {
    title: "Contract-first transport",
    description:
      "REST handlers and shared contracts sit between the UI shell and application services.",
    Icon: Waypoints,
  },
  {
    title: "Predictable boundaries",
    description:
      "Views compose widgets, widgets consume shared UI, and components stay away from direct database reads.",
    Icon: DatabaseZap,
  },
] as const;

export function DashboardFoundationWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Operating model</CardTitle>
        <CardDescription>
          The first shell stays simple while keeping the approved app
          boundaries visible.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {operatingPrinciples.map(({ title, description, Icon }, index) => (
          <div key={title} className="flex flex-col gap-4">
            {index > 0 ? <Separator /> : null}
            <div className="flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <Icon className="size-4" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="font-medium">{title}</h2>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
